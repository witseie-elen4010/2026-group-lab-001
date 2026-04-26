const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getLecturerAvailability } = require('../models/lecturer_availability_db')

const router = express.Router()

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const getWeekdayFromIso = function (isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return WEEKDAYS[d.getUTCDay()]
}

const timeToMinutes = function (timeStr) {
  const parts = timeStr.split(':').map(Number)
  return parts[0] * 60 + parts[1]
}

router.get('/', (req, res) => {
  const username = req.session?.user?.username || ''

  res.status(501).render('schedule_consultation', {
    error: 'This page is not available yet.',
    homePath: '/home',
    message: 'Scheduling a consultation has not been built yet.',
    title: 'Schedule a Consultation',
    username
  })
})

/**
 * POST /schedule_consultation
 * Body: { lecturer, date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM) }
 * Returns JSON indicating whether the requested slot fits the lecturer's availability.
 */
router.post('/', async (req, res) => {
  const lecturer = (req.body.lecturer || req.body.username || '').trim()
  const date = (req.body.date || '').trim()
  const startTime = (req.body.startTime || '').trim()
  const endTime = (req.body.endTime || '').trim()

  if (!lecturer || !ISO_DATE_PATTERN.test(date) || !TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return res.status(400).json({ success: false, error: 'Invalid input. Provide lecturer, date, startTime, endTime.' })
  }

  try {
    await connectToDatabase()
    const availability = await getLecturerAvailability(lecturer)

    if (!availability) {
      return res.status(400).json({ success: false, error: 'Lecturer has not set availability.' })
    }

    if (Array.isArray(availability.exceptionDates) && availability.exceptionDates.includes(date)) {
      return res.status(400).json({ success: false, error: 'Lecturer is unavailable on this date.' })
    }

    const weekday = getWeekdayFromIso(date)
    if (!weekday) return res.status(400).json({ success: false, error: 'Invalid date.' })

    const weekly = Array.isArray(availability.weeklyAvailability) ? availability.weeklyAvailability : []
    const requestedStart = timeToMinutes(startTime)
    const requestedEnd = timeToMinutes(endTime)

    let allowed = false
    for (const slot of weekly) {
      if (!slot || typeof slot !== 'object') continue
      if ((slot.day || '').toLowerCase() !== weekday) continue
      if (!TIME_PATTERN.test(slot.startTime) || !TIME_PATTERN.test(slot.endTime)) continue
      const slotStart = timeToMinutes(slot.startTime)
      const slotEnd = timeToMinutes(slot.endTime)
      if (requestedStart >= slotStart && requestedEnd <= slotEnd) {
        allowed = true
        break
      }
    }

    if (!allowed) {
      return res.status(400).json({ success: false, error: 'Requested time is outside lecturer availability.' })
    }

    // Minimal implementation: we accept or reject based on availability only.
    // Persisting bookings and enforcing student counts/dailyMax can be added later.
    return res.json({ success: true, message: 'Requested slot is available.' })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error while checking availability.' })
  }
})

module.exports = router

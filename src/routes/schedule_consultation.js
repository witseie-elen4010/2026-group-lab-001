const express = require('express')
const { connectToDatabase } = require('../models/db')
const { listConsultationsForLecturerOnDate } = require('../models/consultation_db')
const { getLecturerAvailability } = require('../models/lecturer_availability_db')
const { validateLecturerAvailability } = require('../services/consultation_availability_validation')

const router = express.Router()

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

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
    const scheduledConsultations = await listConsultationsForLecturerOnDate(lecturer, date)
    const validation = validateLecturerAvailability({
      availability,
      date,
      endTime,
      scheduledConsultations,
      startTime
    })

    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error })
    }

    return res.json({ success: true, message: 'Requested slot is available.' })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error while checking availability.' })
  }
})

module.exports = router

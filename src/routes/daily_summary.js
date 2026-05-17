'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getDailyConsultationsForLecturer } = require('../models/consultation_db')

const router = express.Router()

const PAGE_TITLE = 'Daily Summary'
const UNAUTHORISED_ERROR = 'Only lecturers can access the daily summary.'
const LOAD_ERROR = 'Unable to load daily summary right now.'

/**
 * Returns today's ISO date string in YYYY-MM-DD format using local time.
 * @returns {string} Today's date.
 */
const getTodayIsoDate = function () {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Groups consultations by their start time slot.
 * @param {Array<object>} consultations - Enriched consultation objects.
 * @returns {Array<{timeSlot: string, consultations: Array<object>}>} Time-slot groups sorted by time.
 */
const groupConsultationsByTimeSlot = function (consultations) {
  const grouped = {}

  consultations.forEach(function (consultation) {
    const slot = consultation.startTime || 'Unknown'
    if (!grouped[slot]) {
      grouped[slot] = []
    }
    grouped[slot].push(consultation)
  })

  return Object.keys(grouped).sort().map(function (timeSlot) {
    return { timeSlot, consultations: grouped[timeSlot] }
  })
}

/**
 * Renders the daily summary page.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Render options.
 * @param {string} [options.error=''] - Error message.
 * @param {Array<object>} [options.timeSlots=[]] - Grouped time slot data.
 * @param {string} [options.todayLabel=''] - Human-readable date label.
 * @param {number} [options.statusCode=200] - HTTP status code.
 * @param {string} [options.username=''] - Logged in username.
 * @returns {import('express').Response} Rendered response.
 */
const renderDailySummary = function (res, {
  error = '',
  timeSlots = [],
  todayLabel = '',
  statusCode = 200,
  username = ''
} = {}) {
  return res.status(statusCode).render('daily_summary', {
    error,
    timeSlots,
    title: PAGE_TITLE,
    todayLabel,
    username
  })
}

router.get('/', async function (req, res) {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''

  if (role !== 'lecturer') {
    return renderDailySummary(res, {
      error: UNAUTHORISED_ERROR,
      statusCode: 403,
      username
    })
  }

  const isoDate = getTodayIsoDate()
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  try {
    await connectToDatabase()
    const consultations = await getDailyConsultationsForLecturer(username, isoDate)
    const timeSlots = groupConsultationsByTimeSlot(consultations)

    return renderDailySummary(res, {
      timeSlots,
      todayLabel,
      username
    })
  } catch {
    return renderDailySummary(res, {
      error: LOAD_ERROR,
      statusCode: 500,
      username
    })
  }
})

module.exports = { router, groupConsultationsByTimeSlot, getTodayIsoDate }

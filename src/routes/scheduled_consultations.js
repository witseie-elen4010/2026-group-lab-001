const { connectToDatabase } = require('../models/db')
const { getUpcomingConsultationsForLecturer } = require('../models/consultation_db')
const express = require('express')
const { buildCurrentMonthCalendar } = require('../utils/calendar')

const router = express.Router()

const DASHBOARD_TITLE = 'Lecturer Dashboard'
const LOAD_ERROR = 'Unable to load upcoming consultations right now.'
const UNAUTHORISED_ERROR = 'Only lecturers can access the lecturer dashboard.'

/**
 * Renders the lecturer dashboard page.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Render options.
 * @param {object} [options.calendar] - Calendar data for the dashboard view.
 * @param {Array<object>} [options.consultations=[]] - Upcoming consultations to display.
 * @param {Record<string, Array<object>>} [options.consultationsByDate={}] - Upcoming consultations keyed by ISO date.
 * @param {string} [options.error=''] - Error message to display.
 * @param {string} [options.homePath='/home'] - Home navigation path.
 * @param {number} [options.statusCode=200] - HTTP status code.
 * @param {string} [options.username=''] - Logged in username.
 * @returns {import('express').Response} Rendered response.
 */
const renderScheduledConsultations = function (res, {
  calendar = buildCurrentMonthCalendar(),
  consultations = [],
  consultationsByDate = {},
  error = '',
  homePath = '/home',
  statusCode = 200,
  username = ''
} = {}) {
  return res.status(statusCode).render('scheduled_consultations', {
    calendar,
    consultations,
    consultationsByDate,
    error,
    homePath,
    title: DASHBOARD_TITLE,
    username
  })
}

/**
 * Groups consultations by ISO date for calendar rendering.
 * @param {Array<object>} consultations - Upcoming consultations.
 * @returns {Record<string, Array<object>>} Consultations keyed by date.
 */
const buildConsultationsByDate = function (consultations) {
  return consultations.reduce(function (groupedConsultations, consultation) {
    if (!consultation.date) {
      return groupedConsultations
    }

    if (!groupedConsultations[consultation.date]) {
      groupedConsultations[consultation.date] = []
    }

    groupedConsultations[consultation.date].push(consultation)

    return groupedConsultations
  }, {})
}

/**
 * Builds the calendar reference date from the earliest consultation.
 * @param {Array<object>} consultations - Upcoming consultations.
 * @returns {Date} Reference date for the dashboard calendar.
 */
const getCalendarReferenceDate = function (consultations) {
  const earliestConsultationDate = consultations[0]?.date || ''

  if (!earliestConsultationDate) {
    return new Date()
  }

  return new Date(`${earliestConsultationDate}T00:00`)
}

router.get('/', async function (req, res) {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''

  if (role !== 'lecturer') {
    return renderScheduledConsultations(res, {
      error: UNAUTHORISED_ERROR,
      statusCode: 403,
      username
    })
  }

  try {
    await connectToDatabase()
    const consultations = await getUpcomingConsultationsForLecturer(username)
    const consultationsByDate = buildConsultationsByDate(consultations)
    const calendar = buildCurrentMonthCalendar(getCalendarReferenceDate(consultations))

    return renderScheduledConsultations(res, {
      calendar,
      consultations,
      consultationsByDate,
      username
    })
  } catch {
    return renderScheduledConsultations(res, {
      error: LOAD_ERROR,
      statusCode: 500,
      username
    })
  }
})

module.exports = router

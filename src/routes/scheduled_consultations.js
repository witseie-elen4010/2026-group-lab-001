const { connectToDatabase } = require('../models/db')
const { getUpcomingConsultationsForLecturer } = require('../models/consultation_db')
const express = require('express')

const router = express.Router()

const DASHBOARD_TITLE = 'Lecturer Dashboard'
const LOAD_ERROR = 'Unable to load upcoming consultations right now.'
const UNAUTHORISED_ERROR = 'Only lecturers can access the lecturer dashboard.'

/**
 * Renders the lecturer dashboard page.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Render options.
 * @param {Array<object>} [options.consultations=[]] - Upcoming consultations to display.
 * @param {string} [options.error=''] - Error message to display.
 * @param {string} [options.homePath='/home'] - Home navigation path.
 * @param {number} [options.statusCode=200] - HTTP status code.
 * @param {string} [options.username=''] - Logged in username.
 * @returns {import('express').Response} Rendered response.
 */
const renderScheduledConsultations = function (res, {
  consultations = [],
  error = '',
  homePath = '/home',
  statusCode = 200,
  username = ''
} = {}) {
  return res.status(statusCode).render('scheduled_consultations', {
    consultations,
    error,
    homePath,
    title: DASHBOARD_TITLE,
    username
  })
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

    return renderScheduledConsultations(res, {
      consultations,
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

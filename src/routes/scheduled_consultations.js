const express = require('express')

const router = express.Router()

const DASHBOARD_TITLE = 'Lecturer Dashboard'
const UNAUTHORISED_ERROR = 'Only lecturers can access the lecturer dashboard.'

/**
 * Renders the lecturer dashboard page.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Render options.
 * @param {string} [options.error=''] - Error message to display.
 * @param {string} [options.homePath='/home'] - Home navigation path.
 * @param {number} [options.statusCode=200] - HTTP status code.
 * @param {string} [options.username=''] - Logged in username.
 * @returns {import('express').Response} Rendered response.
 */
const renderScheduledConsultations = function (res, {
  error = '',
  homePath = '/home',
  statusCode = 200,
  username = ''
} = {}) {
  return res.status(statusCode).render('scheduled_consultations', {
    error,
    homePath,
    title: DASHBOARD_TITLE,
    username
  })
}

router.get('/', function (req, res) {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''

  if (role !== 'lecturer') {
    return renderScheduledConsultations(res, {
      error: UNAUTHORISED_ERROR,
      statusCode: 403,
      username
    })
  }

  return renderScheduledConsultations(res, {
    username
  })
})

module.exports = router

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { searchLecturers } = require('../models/user_db')

const router = express.Router()

/**
 * Converts lecturer documents into option objects for the consultation form.
 * @param {Array<object>} lecturers - Lecturer documents from the database.
 * @returns {Array<object>} Lecturer options for the view.
 */
const buildLecturerOptions = function (lecturers = []) {
  return lecturers.map(function (lecturer) {
    const fullName = `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim()

    return {
      id: lecturer.username || '',
      name: fullName || lecturer.username || 'Unknown lecturer'
    }
  })
}

/**
 * Renders the create consultation form.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - View options.
 * @param {number} [options.statusCode=200] - HTTP status code to send.
 * @param {string} [options.error=''] - Error message to display.
 * @param {string} [options.username=''] - Logged-in username.
 * @param {Array<object>} [options.lecturers=[]] - Lecturer dropdown options.
 * @returns {import('express').Response} The rendered response.
 */
const renderCreateConsultation = function (res, {
  statusCode = 200,
  error = '',
  username = '',
  lecturers = []
} = {}) {
  return res.status(statusCode).render('create_consultation', {
    consultationTitle: '',
    error,
    lecturers,
    selectedDatetime: '',
    selectedLecturerId: '',
    title: 'Create Consultation',
    username
  })
}

router.get('/new', async function (req, res) {
  const username = req.session?.user?.username || ''
  const universityId = req.session?.user?.universityId || ''

  try {
    await connectToDatabase()
    const lecturers = await searchLecturers({ universityId })

    return renderCreateConsultation(res, {
      lecturers: buildLecturerOptions(lecturers),
      username
    })
  } catch {
    return renderCreateConsultation(res, {
      statusCode: 500,
      error: 'Unable to load the consultation form right now.',
      username
    })
  }
})

module.exports = router

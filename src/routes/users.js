const express = require('express')
const { connectToDatabase } = require('../models/db')
const { followLecturer, getUser } = require('../models/user_db')
const { findWitsDegreeCourseTemplate } = require('../services/wits_degree_course_templates')

const router = express.Router()

const FOLLOW_FORBIDDEN_ERROR = 'Only students can follow lecturers.'
const FOLLOW_INVALID_TARGET_ERROR = 'Please select a valid lecturer.'
const FOLLOW_MISSING_TARGET_ERROR = 'Please select a lecturer to follow.'
const FOLLOW_MISSING_STUDENT_ERROR = 'Student not found.'
const FOLLOW_SERVER_ERROR = 'Sorry. We could not save your followed lecturer right now.'

const buildDisplayName = function (user, fallbackUsername) {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()

  return fullName || user?.username || fallbackUsername
}

const getAcceptHeader = function (req) {
  if (req.get && typeof req.get === 'function') {
    return req.get('accept') || ''
  }

  return req.headers?.accept || ''
}

const isHtmlRequest = function (req) {
  const acceptHeader = getAcceptHeader(req)

  return acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')
}

const setFlashMessage = function (req, type, message) {
  req.session = req.session || {}
  req.session.flash = { [type]: message }
}

const buildAcademicTemplateResponse = function (template) {
  if (!template) {
    return {
      matched: false,
      template: null
    }
  }

  return {
    matched: true,
    template: {
      coursePrefixes: template.coursePrefixes,
      courses: template.suggestedCourses,
      degreeName: template.degreeName,
      faculty: template.faculty,
      lastUpdated: template.lastUpdated,
      sourceUrls: template.sourceUrls
    }
  }
}

/**
 * Sends a response for the lecturer follow endpoint.
 * Redirects HTML form submissions back to the home page with a flash message,
 * and returns JSON for programmatic clients.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Response options.
 * @param {number} options.statusCode - HTTP status code to send.
 * @param {boolean} options.success - Whether the operation succeeded.
 * @param {boolean} [options.alreadyFollowing=false] - Whether the lecturer was already followed.
 * @param {string} [options.error=''] - Error message for failed requests.
 * @param {string} [options.successMessage=''] - Success message for HTML redirects.
 * @returns {import('express').Response} JSON response or redirect response.
 */
const respond = function (req, res, { statusCode, success, alreadyFollowing = false, error = '', successMessage = '' }) {
  if (isHtmlRequest(req)) {
    if (success) {
      setFlashMessage(req, 'success', successMessage)
    } else {
      setFlashMessage(req, 'error', error)
    }

    return res.redirect('/home')
  }

  if (success) {
    return res.status(statusCode).json({ alreadyFollowing, success: true })
  }

  return res.status(statusCode).json({ error, success: false })
}

router.get('/academic-template', (req, res) => {
  const degree = req.query.degree?.trim() || ''

  if (!degree) {
    return res.json(buildAcademicTemplateResponse(null))
  }

  return res.json(buildAcademicTemplateResponse(findWitsDegreeCourseTemplate(degree)))
})

router.post('/:id/follow', async (req, res) => {
  const studentUsername = req.session?.user?.username || ''
  const role = req.session?.user?.role || ''
  const universityId = req.session?.user?.universityId || ''
  const lecturerUsername = req.params.id?.trim() || ''

  if (role !== 'student') {
    return respond(req, res, {
      error: FOLLOW_FORBIDDEN_ERROR,
      statusCode: 403,
      success: false
    })
  }

  if (!lecturerUsername) {
    return respond(req, res, {
      error: FOLLOW_MISSING_TARGET_ERROR,
      statusCode: 400,
      success: false
    })
  }

  try {
    await connectToDatabase()
    const lecturer = await getUser(lecturerUsername)

    if (!lecturer || lecturer.role !== 'lecturer' || lecturer.universityId !== universityId) {
      return respond(req, res, {
        error: FOLLOW_INVALID_TARGET_ERROR,
        statusCode: 404,
        success: false
      })
    }

    const followResult = await followLecturer(studentUsername, lecturerUsername)

    if (!followResult.matchedCount) {
      return respond(req, res, {
        error: FOLLOW_MISSING_STUDENT_ERROR,
        statusCode: 404,
        success: false
      })
    }

    const lecturerName = buildDisplayName(lecturer, lecturerUsername)
    const alreadyFollowing = followResult.modifiedCount === 0

    return respond(req, res, {
      alreadyFollowing,
      statusCode: 200,
      successMessage: alreadyFollowing
        ? `You are already following ${lecturerName}.`
        : `You are now following ${lecturerName}.`,
      success: true
    })
  } catch {
    return respond(req, res, {
      error: FOLLOW_SERVER_ERROR,
      statusCode: 500,
      success: false
    })
  }
})

module.exports = router

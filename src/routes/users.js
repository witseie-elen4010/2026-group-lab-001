const express = require('express')
const { connectToDatabase } = require('../models/db')
const { followLecturer, getUser } = require('../models/user_db')

const router = express.Router()

const FOLLOW_FORBIDDEN_ERROR = 'Only students can follow lecturers.'
const FOLLOW_INVALID_TARGET_ERROR = 'Please select a valid lecturer.'
const FOLLOW_MISSING_TARGET_ERROR = 'Please select a lecturer to follow.'
const FOLLOW_MISSING_STUDENT_ERROR = 'Student not found.'
const FOLLOW_SERVER_ERROR = 'Sorry. We could not save your followed lecturer right now.'

/**
 * Sends a JSON response for the lecturer follow endpoint.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Response options.
 * @param {number} options.statusCode - HTTP status code to send.
 * @param {boolean} options.success - Whether the operation succeeded.
 * @param {boolean} [options.alreadyFollowing=false] - Whether the lecturer was already followed.
 * @param {string} [options.error=''] - Error message for failed requests.
 * @returns {import('express').Response} JSON response.
 */
const respond = function (res, { statusCode, success, alreadyFollowing = false, error = '' }) {
  if (success) {
    return res.status(statusCode).json({ alreadyFollowing, success: true })
  }

  return res.status(statusCode).json({ error, success: false })
}

router.post('/:id/follow', async (req, res) => {
  const studentUsername = req.session?.user?.username || ''
  const role = req.session?.user?.role || ''
  const universityId = req.session?.user?.universityId || ''
  const lecturerUsername = req.params.id?.trim() || ''

  if (role !== 'student') {
    return respond(res, {
      error: FOLLOW_FORBIDDEN_ERROR,
      statusCode: 403,
      success: false
    })
  }

  if (!lecturerUsername) {
    return respond(res, {
      error: FOLLOW_MISSING_TARGET_ERROR,
      statusCode: 400,
      success: false
    })
  }

  try {
    await connectToDatabase()
    const lecturer = await getUser(lecturerUsername)

    if (!lecturer || lecturer.role !== 'lecturer' || lecturer.universityId !== universityId) {
      return respond(res, {
        error: FOLLOW_INVALID_TARGET_ERROR,
        statusCode: 404,
        success: false
      })
    }

    const followResult = await followLecturer(studentUsername, lecturerUsername)

    if (!followResult.matchedCount) {
      return respond(res, {
        error: FOLLOW_MISSING_STUDENT_ERROR,
        statusCode: 404,
        success: false
      })
    }

    return respond(res, {
      alreadyFollowing: followResult.modifiedCount === 0,
      statusCode: 200,
      success: true
    })
  } catch {
    return respond(res, {
      error: FOLLOW_SERVER_ERROR,
      statusCode: 500,
      success: false
    })
  }
})

module.exports = router

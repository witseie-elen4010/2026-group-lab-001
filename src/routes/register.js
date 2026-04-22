const express = require('express')
const { connectToDatabase } = require('../models/db')
const { addUser } = require('../models/user_db')
const { hashPassword } = require('../utils/password')
const ROUTER = express.Router()
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PLACEHOLDER_USER_FIELDS = Object.freeze({
  facultyId: 'unassigned',
  firstName: 'Pending',
  lastName: 'Pending',
  role: 'student',
  schoolId: 'unassigned',
  universityId: 'unassigned'
})

/**
 * Renders the register page with the supplied view state.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Response rendering options.
 * @param {number} [options.statusCode=200] - HTTP status code to send.
 * @param {string} [options.error=''] - Error message to show in the view.
 * @param {string} [options.emailAddress=''] - Email address to preserve in the form.
 * @param {string} [options.username=''] - Username to preserve in the form.
 * @returns {import('express').Response} The rendered response.
 */
const renderRegister = function (res, { statusCode = 200, error = '', emailAddress = '', username = '' } = {}) {
  return res.status(statusCode).render('register', {
    title: 'Register',
    error,
    emailAddress,
    username
  })
}

/**
 * Builds a user record from the current register form fields.
 * @param {object} input - User details from the register form.
 * @param {string} input.emailAddress - Raw email address from the request.
 * @param {string} input.password - Raw password from the request.
 * @param {string} input.username - Username from the request.
 * @returns {Promise<object>} The user document ready for insertion.
 */
const buildUser = async function ({ emailAddress, password, username }) {
  return {
    ...PLACEHOLDER_USER_FIELDS,
    email: emailAddress.toLowerCase(),
    passwordHash: await hashPassword(password),
    username
  }
}

ROUTER.get('/', (req, res) => {
  return renderRegister(res)
})

ROUTER.post('/', async (req, res) => {
  const emailAddress = req.body.emailAddress?.trim() || ''
  const username = req.body.username?.trim() || ''
  const password = req.body.password || ''

  if (!emailAddress || !username || !password) {
    return renderRegister(res, {
      statusCode: 400,
      error: 'Username, Email and Password are required.',
      emailAddress,
      username
    })
  }

  if (!BASIC_EMAIL_REGEX.test(emailAddress)) {
    return renderRegister(res, {
      statusCode: 400,
      error: 'Enter a valid email address.',
      emailAddress,
      username
    })
  }

  try {
    await connectToDatabase()
    await addUser(await buildUser({ emailAddress, password, username }))
    return res.redirect('/login')
  } catch (error) {
    if (error?.code === 11000) {
      return renderRegister(res, {
        statusCode: 409,
        error: 'That username is already taken.',
        emailAddress,
        username
      })
    }

    return renderRegister(res, {
      statusCode: 500,
      error: 'Sorry. We could not create your account. Try again later.',
      emailAddress,
      username
    })
  }
})

module.exports = ROUTER

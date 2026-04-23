const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getUser } = require('../models/user_db')
const { verifyPassword } = require('../utils/password')

const router = express.Router()

/**
 * Renders the login page with the supplied view state.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Response rendering options.
 * @param {number} [options.statusCode=200] - HTTP status code to send.
 * @param {string} [options.error=''] - Error message to show in the view.
 * @param {string} [options.username=''] - Username to preserve in the form.
 * @returns {import('express').Response} The rendered response.
 */
const renderLogin = function (res, { statusCode = 200, error = '', username = '' } = {}) {
  return res.status(statusCode).render('login', {
    title: 'Log In',
    error,
    username
  })
}

router.get('/', (req, res) => {
  return renderLogin(res)
})

router.post('/', async (req, res) => {
  const username = req.body.username?.trim() || ''
  const password = req.body.password || ''

  if (!username || !password) {
    return renderLogin(res, {
      statusCode: 400,
      error: 'Username and Password are required.',
      username
    })
  }

  try {
    await connectToDatabase()
    const user = await getUser(username)
    if (!user) {
      return renderLogin(res, {
        statusCode: 404,
        error: 'User does not exist.',
        username
      })
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return renderLogin(res, {
        statusCode: 401,
        error: 'Password is incorrect.',
        username
      })
    }

    return res.redirect(`/home?username=${encodeURIComponent(username)}`)
  } catch (error) {
    return renderLogin(res, {
      statusCode: 500,
      error: 'Sorry. We could not log you in. Try again later.',
      username
    })
  }
})

module.exports = router

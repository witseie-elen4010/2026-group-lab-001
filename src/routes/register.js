const express = require('express')
const { connectToDatabase } = require('../models/db')
const { addUser } = require('../models/user_db')
const { validateSelection } = require('../services/institution_validation')
const { hashPassword } = require('../utils/password')
const router = express.Router()
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PLACEHOLDER_USER_FIELDS = Object.freeze({
  facultyId: 'unassigned',
  schoolId: 'unassigned'
})

/**
 * Renders the register page with the supplied view state.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Response rendering options.
 * @param {number} [options.statusCode=200] - HTTP status code to send.
 * @param {string} [options.error=''] - Error message to show in the view.
 * @param {string} [options.emailAddress=''] - Email address to preserve in the form.
 * @param {string} [options.username=''] - Username to preserve in the form.
 * @param {string} [options.university=''] - University to preserve in the form.
 * @param {string} [options.faculty=''] - Faculty to preserve in the form.
 * @param {string} [options.school=''] - School to preserve in the form.
 * @param {string} [options.role=''] - Role to preserve in the form.
 * @param {string} [options.name=''] - First name(s) to preserve in the form.
 * @param {string} [options.surname=''] - Surname to preserve in the form.
 * @returns {import('express').Response} The rendered response.
 */
const renderRegister = function (res, {
  statusCode = 200,
  error = '',
  emailAddress = '',
  username = '',
  university = '',
  faculty = '',
  school = '',
  role = '',
  name = '',
  surname = ''
} = {}) {
  return res.status(statusCode).render('register', {
    title: 'Register',
    error,
    emailAddress,
    username,
    university,
    faculty,
    school,
    role,
    name,
    surname
  })
}

/**
 * Builds a user record from the current register form fields.
 * @param {object} input - User details from the register form.
 * @param {string} input.emailAddress - Raw email address from the request.
 * @param {string} input.password - Raw password from the request.
 * @param {string} input.username - Username from the request.
 * @param {string} [input.university=''] - University from the request.
 * @param {string} [input.faculty=''] - Faculty from the request -optional.
 * @param {string} [input.school=''] - School from the request -optional
 * @param {string} [input.role=''] - Role from the request.
 * @returns {Promise<object>} The user document ready for insertion.
 */
const buildUser = async function ({
  emailAddress,
  password,
  username,
  name,
  surname,
  university = '',
  faculty = '',
  school = '',
  role = ''
}) {
  return {
    lastName: surname,
    firstName: name,
    role: role.toLowerCase(),
    schoolId: school || PLACEHOLDER_USER_FIELDS.schoolId,
    facultyId: faculty || PLACEHOLDER_USER_FIELDS.facultyId,
    universityId: university,
    email: emailAddress.toLowerCase(),
    passwordHash: await hashPassword(password),
    username
  }
}

router.get('/', (req, res) => {
  return renderRegister(res)
})

router.post('/', async (req, res) => {
  const emailAddress = req.body.emailAddress?.trim() || ''
  const username = req.body.username?.trim() || ''
  const password = req.body.password || ''
  const university = req.body.university?.trim() || ''
  const faculty = req.body.faculty?.trim() || ''
  const school = req.body.school?.trim() || ''
  const role = req.body.role?.trim() || ''
  const name = req.body.name?.trim() || ''
  const surname = req.body.surname?.trim() || ''
  const formValues = {
    emailAddress,
    username,
    university,
    faculty,
    school,
    role,
    name,
    surname
  }

  if (!emailAddress || !username || !password || !university || !faculty || !school || !name || !surname || !role) {
    return renderRegister(res, {
      statusCode: 400,
      error: 'Username, password, first/last names and institution credentials are required.',
      ...formValues
    })
  }

  if (!BASIC_EMAIL_REGEX.test(emailAddress)) {
    return renderRegister(res, {
      statusCode: 400,
      error: 'Enter a valid email address.',
      ...formValues
    })
  }

  try {
    await connectToDatabase()
    const institutionValidation = await validateSelection({
      faculty,
      school,
      university
    })

    if (!institutionValidation.isValid) {
      return renderRegister(res, {
        statusCode: institutionValidation.statusCode,
        error: institutionValidation.error,
        ...formValues
      })
    }

    await addUser(await buildUser({
      emailAddress,
      password,
      username,
      name,
      surname,
      university,
      faculty,
      school,
      role
    }))
    return res.redirect('/login')
  } catch (error) {
    if (error?.code === 11000) {
      return renderRegister(res, {
        statusCode: 409,
        error: 'That username is already taken.',
        ...formValues
      })
    }

    return renderRegister(res, {
      statusCode: 500,
      error: 'Sorry. We could not create your account. Try again later.',
      ...formValues
    })
  }
})

module.exports = router

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { addUser } = require('../models/user_db')
const { validateSelection } = require('../services/institution_validation')
const router = express.Router()

const PLACEHOLDER_USER_FIELDS = Object.freeze({
  facultyId: 'unassigned',
  schoolId: 'unassigned'
})

const renderComplete = function (res, pendingGoogle, {
  statusCode = 200,
  error = '',
  username = '',
  role = '',
  university = '',
  faculty = '',
  school = ''
} = {}) {
  return res.status(statusCode).render('register_complete', {
    title: 'Complete Your Profile',
    error,
    username,
    role,
    university,
    faculty,
    school,
    firstName: pendingGoogle.firstName,
    lastName: pendingGoogle.lastName,
    email: pendingGoogle.email
  })
}

router.get('/', (req, res) => {
  if (!req.session.pendingGoogle) {
    return res.redirect('/register')
  }
  return renderComplete(res, req.session.pendingGoogle)
})

router.post('/', async (req, res) => {
  if (!req.session.pendingGoogle) {
    return res.redirect('/register')
  }

  const { googleId, email, firstName, lastName } = req.session.pendingGoogle
  const username = req.body.username?.trim() || ''
  const role = req.body.role?.trim() || ''
  const university = req.body.university?.trim() || ''
  const faculty = req.body.faculty?.trim() || ''
  const school = req.body.school?.trim() || ''
  const formValues = { username, role, university, faculty, school }

  if (!username || !role || !university || !faculty || !school) {
    return renderComplete(res, req.session.pendingGoogle, {
      statusCode: 400,
      error: 'Username, role, and all institution fields are required.',
      ...formValues
    })
  }

  try {
    await connectToDatabase()
    const institutionValidation = await validateSelection({ university, faculty, school })

    if (!institutionValidation.isValid) {
      return renderComplete(res, req.session.pendingGoogle, {
        statusCode: institutionValidation.statusCode,
        error: institutionValidation.error,
        ...formValues
      })
    }

    await addUser({
      googleId,
      email,
      firstName,
      lastName,
      username,
      role: role.toLowerCase(),
      universityId: university,
      facultyId: faculty || PLACEHOLDER_USER_FIELDS.facultyId,
      schoolId: school || PLACEHOLDER_USER_FIELDS.schoolId
    })

    req.session.user = {
      role: role.toLowerCase(),
      username,
      universityId: university,
      facultyId: faculty || PLACEHOLDER_USER_FIELDS.facultyId,
      schoolId: school || PLACEHOLDER_USER_FIELDS.schoolId,
      firstName,
      lastName
    }
    delete req.session.pendingGoogle
    return res.redirect('/home')
  } catch (err) {
    if (err?.code === 11000) {
      return renderComplete(res, req.session.pendingGoogle, {
        statusCode: 409,
        error: 'That username is already taken.',
        ...formValues
      })
    }
    return renderComplete(res, req.session.pendingGoogle, {
      statusCode: 500,
      error: 'Sorry. We could not create your account. Try again later.',
      ...formValues
    })
  }
})

module.exports = router

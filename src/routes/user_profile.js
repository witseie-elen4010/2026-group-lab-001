const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getUser } = require('../models/user_db')

const ROUTER = express.Router()

const renderProfile = function (res, {
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
  return res.status(statusCode).render('user_profile', {
    title: 'User Profile',
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

ROUTER.get('/', async (req, res) => {
  const username = req.query.username?.trim() || ''

  if (!username) {
    return res.redirect('/login')
  }

  try {
    await connectToDatabase()
    const user = await getUser(username)

    if (!user) {
      return res.redirect('/login')
    }

    return renderProfile(res, {
      emailAddress: user.email,
      username: user.username || username,
      university: user.universityId,
      faculty: user.facultyId,
      school: user.schoolId,
      role: user.role,
      name: user.firstName,
      surname: user.lastName
    })
  } catch (error) {
    return renderProfile(res, {
      statusCode: 500,
      error: 'Sorry. We could not find user information.',
      username
    })
  }
})

module.exports = ROUTER

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getUser, updateUserInstitutions } = require('../models/user_db')
const { validateSelection } = require('../services/institution_validation')

const router = express.Router()

const renderProfile = function (res, {
  statusCode = 200,
  error = '',
  emailAddress = '',
  username = '',
  viewer = '',
  canEdit = false,
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
    viewer,
    canEdit,
    university,
    faculty,
    school,
    role,
    name,
    surname
  })
}

const buildProfileViewState = function (user, overrides = {}) {
  return {
    emailAddress: user?.email || '',
    username: user?.username || '',
    viewer: '',
    canEdit: false,
    university: user?.universityId || '',
    faculty: user?.facultyId || '',
    school: user?.schoolId || '',
    role: user?.role || '',
    name: user?.firstName || '',
    surname: user?.lastName || '',
    ...overrides
  }
}

router.get('/', async (req, res) => {
  const viewer = req.session?.user?.username || ''
  const profileUsername = req.query.user?.trim() || req.query.username?.trim() || viewer

  if (!profileUsername) {
    return res.redirect('/login')
  }

  try {
    await connectToDatabase()
    const user = await getUser(profileUsername)

    if (!user) {
      return res.redirect('/login')
    }

    const resolvedUsername = user.username || profileUsername

    return renderProfile(res, buildProfileViewState(user, {
      canEdit: viewer === resolvedUsername,
      username: resolvedUsername,
      viewer
    }))
  } catch (error) {
    return renderProfile(res, {
      statusCode: 500,
      error: 'Sorry. We could not find user information.',
      username: profileUsername,
      viewer
    })
  }
})

router.post('/', async (req, res) => {
  const viewer = req.session?.user?.username || ''
  const profileUsername = req.body.user?.trim() || req.body.username?.trim() || viewer
  const university = req.body.university?.trim() || ''
  const faculty = req.body.faculty?.trim() || ''
  const school = req.body.school?.trim() || ''

  if (!profileUsername) {
    return res.redirect('/login')
  }

  try {
    await connectToDatabase()
    const user = await getUser(profileUsername)

    if (!user) {
      return res.redirect('/login')
    }

    const resolvedUsername = user.username || profileUsername

    if (viewer !== resolvedUsername) {
      return renderProfile(res, {
        statusCode: 403,
        error: 'You can only edit your own profile.',
        ...buildProfileViewState(user, {
          canEdit: false,
          username: resolvedUsername,
          viewer
        })
      })
    }

    const institutionValidation = await validateSelection({
      faculty,
      school,
      university
    })

    if (!institutionValidation.isValid) {
      return renderProfile(res, {
        statusCode: institutionValidation.statusCode,
        error: institutionValidation.error,
        ...buildProfileViewState(user, {
          canEdit: true,
          faculty,
          school,
          university,
          username: resolvedUsername,
          viewer
        })
      })
    }

    await updateUserInstitutions(resolvedUsername, {
      facultyId: faculty,
      schoolId: school,
      universityId: university
    })

    return renderProfile(res, buildProfileViewState(user, {
      canEdit: true,
      faculty,
      school,
      university,
      username: resolvedUsername,
      viewer
    }))
  } catch (error) {
    return renderProfile(res, {
      statusCode: 500,
      error: 'Sorry. We could not update your institution information.',
      username: profileUsername,
      viewer,
      university,
      faculty,
      school
    })
  }
})

module.exports = router

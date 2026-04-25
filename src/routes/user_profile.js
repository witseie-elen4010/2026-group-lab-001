const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getUser, updateUserInstitutions } = require('../models/user_db')
const { validateSelection } = require('../services/institution_validation')
const { getLecturerAvailability, setLecturerAvailability } = require('../models/lecturer_availability_db')
const { validateConsultationPreferences } = require('../services/consultation_preferences_validation')

const router = express.Router()

const renderProfile = function (res, {
  statusCode = 200,
  error = '',
  prefError = '',
  emailAddress = '',
  username = '',
  canEdit = false,
  university = '',
  faculty = '',
  school = '',
  role = '',
  name = '',
  surname = '',
  consultationPreferences = null
} = {}) {
  return res.status(statusCode).render('user_profile', {
    title: 'User Profile',
    error,
    prefError,
    emailAddress,
    username,
    canEdit,
    university,
    faculty,
    school,
    role,
    name,
    surname,
    consultationPreferences
  })
}

const buildProfileViewState = function (user, overrides = {}) {
  return {
    emailAddress: user?.email || '',
    username: user?.username || '',
    canEdit: false,
    university: user?.universityId || '',
    faculty: user?.facultyId || '',
    school: user?.schoolId || '',
    role: user?.role || '',
    name: user?.firstName || '',
    surname: user?.lastName || '',
    consultationPreferences: null,
    ...overrides
  }
}

const handleConsultationPreferences = async function (req, res, viewer, profileUsername) {
  const minStudents = parseInt(req.body.minStudents, 10)
  const maxStudents = parseInt(req.body.maxStudents, 10)
  const duration = parseInt(req.body.duration, 10)
  const dailyMax = parseInt(req.body.dailyMax, 10)

  if (isNaN(minStudents) || isNaN(maxStudents) || isNaN(duration) || isNaN(dailyMax)) {
    return res.redirect(`/user_profile?user=${encodeURIComponent(profileUsername)}&prefError=${encodeURIComponent('Please enter valid numbers for all consultation settings.')}`)
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
        ...buildProfileViewState(user, { canEdit: false, username: resolvedUsername })
      })
    }

    const validation = validateConsultationPreferences({ minStudents, maxStudents, duration, dailyMax })

    if (!validation.isValid) {
      const consultationPreferences = { minStudents, maxStudents, duration, dailyMax }
      return renderProfile(res, {
        statusCode: 400,
        ...buildProfileViewState(user, {
          canEdit: true,
          username: resolvedUsername,
          consultationPreferences,
          prefError: validation.error
        })
      })
    }

    await setLecturerAvailability(resolvedUsername, { minStudents, maxStudents, duration, dailyMax })
    return res.redirect(`/user_profile?user=${encodeURIComponent(resolvedUsername)}`)
  } catch {
    return res.redirect(`/user_profile?user=${encodeURIComponent(profileUsername)}&prefError=${encodeURIComponent('Sorry. We could not save your consultation preferences.')}`)
  }
}

router.get('/', async (req, res) => {
  const viewer = req.session?.user?.username || ''
  const profileUsername = req.query.user?.trim() || req.query.username?.trim() || viewer
  const prefError = req.query.prefError?.trim() || ''

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
    let consultationPreferences = null

    if (user.role === 'lecturer') {
      consultationPreferences = await getLecturerAvailability(resolvedUsername)
    }

    return renderProfile(res, buildProfileViewState(user, {
      canEdit: viewer === resolvedUsername,
      username: resolvedUsername,
      consultationPreferences,
      prefError
    }))
  } catch (error) {
    return renderProfile(res, {
      statusCode: 500,
      error: 'Sorry. We could not find user information.',
      username: profileUsername
    })
  }
})

router.post('/', async (req, res) => {
  const viewer = req.session?.user?.username || ''
  const profileUsername = req.body.user?.trim() || req.body.username?.trim() || viewer

  if (!profileUsername) {
    return res.redirect('/login')
  }

  if (req.body.formType === 'consultationPreferences') {
    return handleConsultationPreferences(req, res, viewer, profileUsername)
  }

  const university = req.body.university?.trim() || ''
  const faculty = req.body.faculty?.trim() || ''
  const school = req.body.school?.trim() || ''

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
          username: resolvedUsername
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
          username: resolvedUsername
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
      username: resolvedUsername
    }))
  } catch (error) {
    return renderProfile(res, {
      statusCode: 500,
      error: 'Sorry. We could not update your institution information.',
      username: profileUsername,
      university,
      faculty,
      school
    })
  }
})

module.exports = router

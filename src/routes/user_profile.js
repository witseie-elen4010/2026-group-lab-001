const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getUser, updateUserInstitutions } = require('../models/user_db')
const { validateSelection } = require('../services/institution_validation')
const { getLecturerAvailability, setLecturerAvailability } = require('../models/lecturer_availability_db')
const { validateConsultationPreferences } = require('../services/consultation_preferences_validation')

const router = express.Router()

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Renders the user profile page with the given view state.
 * @param {object} res - Express response object.
 * @param {object} [options] - View state overrides.
 * @param {number} [options.statusCode] - HTTP status code to send.
 * @param {string} [options.error] - General error message to display.
 * @param {string} [options.prefError] - Consultation preferences error message.
 * @param {string} [options.username] - Profile owner's username.
 * @param {boolean} [options.canEdit] - Whether the viewer may edit this profile.
 * @param {object|null} [options.consultationPreferences] - Saved consultation preferences, or null.
 * @returns {object} The Express render response.
 */
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
  consultationPreferences = null,
  weekdays = WEEKDAYS
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
    consultationPreferences,
    weekdays
  })
}

/**
 * Builds the default view state object for a user profile from a database user document.
 * @param {object} user - User document from the database.
 * @param {object} [overrides] - Values that override the defaults derived from the user document.
 * @returns {object} View state ready to be passed to renderProfile.
 */
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
    weekdays: WEEKDAYS,
    ...overrides
  }
}

/**
 * Returns a trimmed string field from a form body.
 * @param {object} formValues - Submitted form values.
 * @param {string} fieldName - Field name to read.
 * @returns {string} The trimmed field value or an empty string.
 */
const getTrimmedField = function (formValues, fieldName) {
  if (typeof formValues[fieldName] !== 'string') {
    return ''
  }

  return formValues[fieldName].trim()
}

/**
 * Builds weekly availability entries from the lecturer settings form.
 * @param {object} formValues - Submitted form values.
 * @returns {Array<object>} Weekly availability entries.
 */
const buildWeeklyAvailability = function (formValues) {
  const weeklyAvailability = []

  for (const day of WEEKDAYS) {
    if (getTrimmedField(formValues, `availability_${day}`) !== 'available') {
      continue
    }

    weeklyAvailability.push({
      day,
      startTime: getTrimmedField(formValues, `start_time_${day}`),
      endTime: getTrimmedField(formValues, `end_time_${day}`)
    })
  }

  return weeklyAvailability
}

/**
 * Builds the list of specific unavailable dates from the lecturer settings form.
 * @param {string} rawDates - Comma-separated or line-separated date values.
 * @returns {Array<string>} Unique ISO date strings.
 */
const parseExceptionDates = function (rawDates) {
  if (!rawDates) {
    return []
  }

  return Array.from(new Set(
    rawDates
      .split(/[\n,]+/)
      .map(function (date) { return date.trim() })
      .filter(Boolean)
  ))
}

/**
 * Checks whether a YYYY-MM-DD string is a real calendar date.
 * @param {string} value - Date string to validate.
 * @returns {boolean} True when the value is a valid ISO date.
 */
const isValidIsoDate = function (value) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

/**
 * Validates lecturer availability settings submitted from the profile form.
 * @param {Array<object>} weeklyAvailability - Weekly availability entries.
 * @param {Array<string>} exceptionDates - Specific unavailable dates.
 * @returns {{isValid: boolean, error: string}} Validation result.
 */
const validateAvailabilitySettings = function (weeklyAvailability, exceptionDates) {
  for (const entry of weeklyAvailability) {
    if (!TIME_PATTERN.test(entry.startTime) || !TIME_PATTERN.test(entry.endTime)) {
      return { isValid: false, error: 'Please enter a valid start and end time for each available weekday.' }
    }

    if (entry.startTime >= entry.endTime) {
      return { isValid: false, error: `Start time must be earlier than end time for ${entry.day}.` }
    }
  }

  for (const exceptionDate of exceptionDates) {
    if (!isValidIsoDate(exceptionDate)) {
      return { isValid: false, error: 'Use valid dates in YYYY-MM-DD format for unavailable dates.' }
    }
  }

  return { isValid: true, error: '' }
}

/**
 * Handles saving a lecturer's consultation preferences from a POST request.
 * Responds with JSON when the request is an AJAX call, or redirects otherwise.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {string} viewer - Username of the currently authenticated user.
 * @param {string} profileUsername - Username of the profile being edited.
 * @returns {Promise<object>} The Express response.
 */
const handleConsultationPreferences = async function (req, res, viewer, profileUsername) {
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest'
  const minStudents = parseInt(req.body.minStudents, 10)
  const maxStudents = parseInt(req.body.maxStudents, 10)
  const duration = parseInt(req.body.duration, 10)
  const dailyMax = parseInt(req.body.dailyMax, 10)
  const weeklyAvailability = buildWeeklyAvailability(req.body)
  const exceptionDates = parseExceptionDates(getTrimmedField(req.body, 'exceptionDates'))

  if (isNaN(minStudents) || isNaN(maxStudents) || isNaN(duration) || isNaN(dailyMax)) {
    const error = 'Please enter valid numbers for all consultation settings.'
    if (isAjax) return res.json({ success: false, error })
    return res.redirect(`/user_profile?user=${encodeURIComponent(profileUsername)}&prefError=${encodeURIComponent(error)}`)
  }

  try {
    await connectToDatabase()
    const user = await getUser(profileUsername)

    if (!user) {
      return res.redirect('/login')
    }

    const resolvedUsername = user.username || profileUsername

    if (viewer !== resolvedUsername) {
      if (isAjax) return res.status(403).json({ success: false, error: 'You can only edit your own profile.' })
      return renderProfile(res, {
        statusCode: 403,
        error: 'You can only edit your own profile.',
        ...buildProfileViewState(user, { canEdit: false, username: resolvedUsername })
      })
    }

    const validation = validateConsultationPreferences({ minStudents, maxStudents, duration, dailyMax })
    const availabilityValidation = validateAvailabilitySettings(weeklyAvailability, exceptionDates)

    if (!validation.isValid) {
      if (isAjax) return res.status(400).json({ success: false, error: validation.error })
      return renderProfile(res, {
        statusCode: 400,
        ...buildProfileViewState(user, {
          canEdit: true,
          username: resolvedUsername,
          consultationPreferences: { minStudents, maxStudents, duration, dailyMax },
          prefError: validation.error
        })
      })
    }

    if (!availabilityValidation.isValid) {
      if (isAjax) return res.status(400).json({ success: false, error: availabilityValidation.error })
      return renderProfile(res, {
        statusCode: 400,
        ...buildProfileViewState(user, {
          canEdit: true,
          username: resolvedUsername,
          consultationPreferences: { minStudents, maxStudents, duration, dailyMax, weeklyAvailability, exceptionDates },
          prefError: availabilityValidation.error
        })
      })
    }

    await setLecturerAvailability(resolvedUsername, {
      minStudents,
      maxStudents,
      duration,
      dailyMax,
      weeklyAvailability,
      exceptionDates
    })
    if (isAjax) return res.json({ success: true })
    return res.redirect(`/user_profile?user=${encodeURIComponent(resolvedUsername)}`)
  } catch {
    const error = 'Sorry. We could not save your consultation preferences.'
    if (isAjax) return res.status(500).json({ success: false, error })
    return res.redirect(`/user_profile?user=${encodeURIComponent(profileUsername)}&prefError=${encodeURIComponent(error)}`)
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

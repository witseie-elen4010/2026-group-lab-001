const express = require('express')
const { connectToDatabase } = require('../models/db')
const { addConsultation, cancelConsultation, getConsultationsForStudent, getUpcomingConsultationsForLecturer, listConsultationsForLecturerOnDate } = require('../models/consultation_db')
const { getLecturerAvailability } = require('../models/lecturer_availability_db')
const { addMinutesToTime, validateLecturerAvailability, findOverlappingConsultation } = require('../services/consultation_availability_validation')
const { getUser, searchLecturers } = require('../models/user_db')

const router = express.Router()
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const CANCEL_ERROR_MESSAGES = {
  'not-found': 'Consultation not found.',
  'not-lecturer': 'Only the assigned lecturer can cancel this consultation.',
  'not-organiser': 'Only the organiser can cancel this consultation.',
  'past-consultation': 'Past consultations cannot be cancelled.'
}

/**
 * Converts lecturer documents into option objects for the consultation form.
 * @param {Array<object>} lecturers - Lecturer documents from the database.
 * @returns {Array<object>} Lecturer options for the view.
 */
const buildLecturerOptions = function (lecturers = []) {
  return lecturers.map(function (lecturer) {
    const fullName = `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim()

    return {
      id: lecturer.username || '',
      name: fullName || lecturer.username || 'Unknown lecturer'
    }
  })
}

/**
 * Returns true when the value is a valid datetime-local input string.
 * @param {string} value - Datetime string to validate.
 * @returns {boolean} True when the value is valid.
 */
const isValidDatetime = function (value) {
  if (!DATETIME_LOCAL_PATTERN.test(value)) {
    return false
  }

  const time = new Date(value).getTime()
  if (Number.isNaN(time)) {
    return false
  }

  // Ensure the datetime is in the future (prevent past bookings)
  return time > Date.now()
}

/**
 * Loads lecturer options for the current student's university.
 * @param {string} universityId - University identifier.
 * @returns {Promise<Array<object>>} Lecturer options for the form.
 */
const loadLecturerOptions = async function (universityId) {
  const lecturers = await searchLecturers({ universityId })
  return buildLecturerOptions(lecturers)
}

/**
 * Renders the create consultation form.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - View options.
 * @param {number} [options.statusCode=200] - HTTP status code to send.
 * @param {string} [options.error=''] - Error message to display.
 * @param {string} [options.username=''] - Logged-in username.
 * @param {string} [options.consultationTitle=''] - Submitted consultation title.
 * @param {Array<object>} [options.lecturers=[]] - Lecturer dropdown options.
 * @param {string} [options.selectedDatetime=''] - Submitted datetime value.
 * @param {string} [options.selectedLecturerId=''] - Submitted lecturer value.
 * @returns {import('express').Response} The rendered response.
 */
const renderCreateConsultation = function (res, {
  statusCode = 200,
  consultationTitle = '',
  error = '',
  lecturers = [],
  selectedCapacity = 1,
  selectedDatetime = '',
  selectedLecturerId = '',
  username = ''
} = {}) {
  const flashError = (res && res.locals && res.locals.flash && res.locals.flash.error) ? res.locals.flash.error : ''
  const finalError = error || flashError

  return res.status(statusCode).render('create_consultation', {
    consultationTitle,
    error: finalError,
    lecturers,
    selectedCapacity,
    selectedDatetime,
    selectedLecturerId,
    title: 'Create Consultation',
    username
  })
}

/**
 * Renders the create consultation form with the current submitted values and an error.
 * @param {import('express').Response} res - Express response object.
 * @param {object} options - Rendering options.
 * @param {string} options.consultationTitle - Submitted consultation title.
 * @param {string} options.error - Error message to display.
 * @param {string} options.selectedDatetime - Submitted datetime value.
 * @param {string} options.selectedLecturerId - Submitted lecturer value.
 * @param {number} [options.statusCode=400] - HTTP status code to send.
 * @param {string} options.universityId - University identifier.
 * @param {string} options.username - Logged-in username.
 * @returns {Promise<import('express').Response>} The rendered response.
 */
const renderCreateConsultationError = async function (res, {
  consultationTitle,
  error,
  selectedCapacity = 1,
  selectedDatetime,
  selectedLecturerId,
  statusCode = 400,
  universityId,
  username
}) {
  let lecturers = []

  try {
    await connectToDatabase()
    lecturers = await loadLecturerOptions(universityId)
  } catch {
    lecturers = []
  }

  return renderCreateConsultation(res, {
    consultationTitle,
    error,
    lecturers,
    selectedCapacity,
    selectedDatetime,
    selectedLecturerId,
    statusCode,
    username
  })
}

router.get('/new', async function (req, res) {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''
  const universityId = req.session?.user?.universityId || ''

  if (role !== 'student' && role !== 'admin') {
    return renderCreateConsultation(res, {
      error: 'Only students can create consultations.',
      statusCode: 403,
      username
    })
  }

  const prefilledLecturerId = (req.query.lecturerId || '').trim()
  const prefilledDate = (req.query.date || '').trim()
  const prefilledTime = (req.query.time || '').trim()
  const selectedDatetime = prefilledDate ? `${prefilledDate}T${prefilledTime || '09:00'}` : ''

  try {
    await connectToDatabase()
    const lecturers = await loadLecturerOptions(universityId)

    return renderCreateConsultation(res, {
      lecturers,
      selectedCapacity: 1,
      selectedDatetime,
      selectedLecturerId: prefilledLecturerId,
      username
    })
  } catch {
    return renderCreateConsultation(res, {
      statusCode: 500,
      error: 'Unable to load the consultation form right now.',
      username
    })
  }
})

router.post('/', async function (req, res) {
  const consultationTitle = req.body.title?.trim() || ''
  const lecturerId = req.body.lecturerId?.trim() || ''
  const datetime = req.body.datetime?.trim() || ''
  const capacityRaw = parseInt(req.body.capacity, 10)
  const capacity = Number.isFinite(capacityRaw) && capacityRaw >= 1 ? capacityRaw : null
  const role = req.session?.user?.role || ''
  const organiserId = req.session?.user?.username || ''
  const universityId = req.session?.user?.universityId || ''

  if (role !== 'student' && role !== 'admin') {
    return renderCreateConsultation(res, {
      consultationTitle,
      error: 'Only students can create consultations.',
      selectedCapacity: capacity ?? 1,
      selectedDatetime: datetime,
      selectedLecturerId: lecturerId,
      statusCode: 403,
      username: organiserId
    })
  }

  if (!consultationTitle || !lecturerId || !isValidDatetime(datetime) || capacity === null) {
    return renderCreateConsultationError(res, {
      consultationTitle,
      error: capacity === null
        ? 'Please enter a valid maximum number of students (at least 1).'
        : 'Please complete all consultation fields with a valid date and time.',
      selectedCapacity: capacity ?? 1,
      selectedDatetime: datetime,
      selectedLecturerId: lecturerId,
      universityId,
      username: organiserId
    })
  }

  try {
    await connectToDatabase()
    const lecturer = await getUser(lecturerId)

    if (!lecturer || lecturer.role !== 'lecturer' || lecturer.universityId !== universityId) {
      return renderCreateConsultationError(res, {
        consultationTitle,
        error: 'Please select a valid lecturer.',
        selectedCapacity: capacity,
        selectedDatetime: datetime,
        selectedLecturerId: lecturerId,
        universityId,
        username: organiserId
      })
    }

    const lecturerAvailability = await getLecturerAvailability(lecturerId)
    const consultationDate = datetime.slice(0, 10)
    const consultationStartTime = datetime.slice(11, 16)
    const consultationEndTime = addMinutesToTime(consultationStartTime, lecturerAvailability?.duration)
    const scheduledConsultations = await listConsultationsForLecturerOnDate(lecturerId, consultationDate)
    const schedulingValidation = validateLecturerAvailability({
      availability: lecturerAvailability,
      date: consultationDate,
      endTime: consultationEndTime,
      scheduledConsultations,
      startTime: consultationStartTime
    })

    if (!schedulingValidation.isValid) {
      return renderCreateConsultationError(res, {
        consultationTitle,
        error: schedulingValidation.error,
        selectedCapacity: capacity,
        selectedDatetime: datetime,
        selectedLecturerId: lecturerId,
        universityId,
        username: organiserId
      })
    }

    // Prevent overlapping bookings based on the lecturer's configured duration
    const conflict = findOverlappingConsultation({
      scheduledConsultations,
      proposedStart: consultationStartTime,
      duration: lecturerAvailability?.duration
    })

    if (conflict) {
      const lecturerName = `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim() || lecturer.username || 'the lecturer'
      const conflictTime = (typeof conflict.datetime === 'string' && conflict.datetime.length >= 16) ? conflict.datetime.slice(11, 16) : ''
      const message = `A consultation is already booked at ${conflictTime} for ${lecturerName}`

      const acceptsJson = req.xhr || (req.get && typeof req.get === 'function' && (req.get('accept') || '').includes('application/json'))

      if (acceptsJson) {
        return res.status(409).json({ error: message })
      }

      // Set a flash message and redirect back to the creation form so the
      // message is shown to the user. Use the session to persist the flash.
      req.session = req.session || {}
      req.session.flash = { error: message }

      return res.redirect('/consultations/new')
    }

    await addConsultation({
      attendees: [organiserId],
      capacity,
      datetime,
      lecturerId,
      organiserId,
      title: consultationTitle
    })

    return res.redirect('/home')
  } catch {
    return renderCreateConsultationError(res, {
      consultationTitle,
      error: 'Unable to create the consultation right now.',
      selectedCapacity: capacity,
      selectedDatetime: datetime,
      selectedLecturerId: lecturerId,
      statusCode: 500,
      universityId,
      username: organiserId
    })
  }
})

router.get('/', async function (req, res) {
  const { username = '', role = '' } = req.session?.user || {}

  if (role !== 'student' && role !== 'admin' && role !== 'lecturer') {
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    await connectToDatabase()

    if (role === 'lecturer') {
      const consultations = await getUpcomingConsultationsForLecturer(username)
      return res.json({ consultations: consultations.map(function (c) { return { ...c, isOrganiser: true } }) })
    }

    const consultations = await getConsultationsForStudent(username)
    return res.json({ consultations })
  } catch {
    return res.status(500).json({ error: 'Unable to load consultations right now.' })
  }
})

router.delete('/:id', async function (req, res) {
  const { username = '', role = '' } = req.session?.user || {}

  if (role !== 'student' && role !== 'admin' && role !== 'lecturer') {
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    await connectToDatabase()
    const result = await cancelConsultation(req.params.id, username, role)

    return result.success
      ? res.json({ success: true })
      : res.status(result.statusCode || 400).json({
        success: false,
        error: CANCEL_ERROR_MESSAGES[result.reason] || 'Unable to cancel consultation.'
      })
  } catch {
    return res.status(500).json({ success: false, error: 'Unable to cancel consultation right now.' })
  }
})

module.exports = router

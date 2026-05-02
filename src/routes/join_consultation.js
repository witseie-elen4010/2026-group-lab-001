const express = require('express')
const { connectToDatabase } = require('../models/db')
const { addStudentToConsultation, JOIN_RESULT_REASONS, searchConsultationsForStudent } = require('../models/consultation_db')
const { getLecturerAvailability } = require('../models/lecturer_availability_db')
const { searchLecturers } = require('../models/user_db')
const { isDateAvailableForLecturer } = require('../services/consultation_availability_validation')

const LOAD_ERROR = 'Unable to load join consultations right now.'
const JOIN_ERROR = 'Unable to join consultation right now.'
const JOIN_ERROR_MESSAGES = {
  [JOIN_RESULT_REASONS.ALREADY_JOINED]: 'You have already joined this consultation.',
  [JOIN_RESULT_REASONS.FULL]: 'This consultation is already full.',
  [JOIN_RESULT_REASONS.NOT_FOUND]: 'Consultation not found.'
}

const router = express.Router()

const buildLecturerOptions = function (lecturers = []) {
  return lecturers.map(function (lecturer) {
    const fullName = `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim()
    return {
      id: lecturer.username || '',
      name: fullName || lecturer.username || 'Unknown lecturer'
    }
  })
}

const renderJoinConsultation = function (res, {
  consultations = [],
  createLink = '',
  emptyStateType = '',
  error = '',
  filters = { lecturerId: '', date: '', time: '' },
  lecturers = [],
  statusCode = 200
} = {}) {
  return res.status(statusCode).render('join_consultation', {
    consultations,
    createLink,
    emptyStateType,
    error,
    filters,
    lecturers
  })
}

router.get('/', async function (req, res) {
  const { username = '', universityId = '', facultyId = '', schoolId = '' } = req.session?.user || {}
  const lecturerId = (req.query.lecturerId || '').trim()
  const date = (req.query.date || '').trim()
  const time = (req.query.time || '').trim()

  try {
    await connectToDatabase()
    const [consultations, lecturerDocs] = await Promise.all([
      searchConsultationsForStudent({ username, lecturerId, date, time }),
      searchLecturers({ universityId, facultyId, schoolId })
    ])
    const lecturers = buildLecturerOptions(lecturerDocs)

    let emptyStateType = ''
    let createLink = ''

    if (consultations.length === 0 && lecturerId && date) {
      const availability = await getLecturerAvailability(lecturerId)
      if (isDateAvailableForLecturer(availability, date, time)) {
        emptyStateType = 'create'
        const timeParam = time ? `&time=${encodeURIComponent(time)}` : ''
        createLink = `/consultations/new?lecturerId=${encodeURIComponent(lecturerId)}&date=${encodeURIComponent(date)}${timeParam}`
      } else {
        emptyStateType = 'violation'
      }
    }

    return renderJoinConsultation(res, {
      consultations,
      createLink,
      emptyStateType,
      filters: { lecturerId, date, time },
      lecturers
    })
  } catch {
    return renderJoinConsultation(res, { error: LOAD_ERROR, statusCode: 500 })
  }
})

router.post('/:consultationId/join', async function (req, res) {
  const { username = '' } = req.session?.user || {}

  try {
    await connectToDatabase()
    const joinResult = await addStudentToConsultation(req.params.consultationId, username)

    return joinResult.success
      ? res.json({ success: true })
      : res.status(joinResult.statusCode || 400).json({
        success: false,
        error: JOIN_ERROR_MESSAGES[joinResult.reason] || JOIN_ERROR
      })
  } catch {
    return res.status(500).json({ success: false, error: JOIN_ERROR })
  }
})

module.exports = router

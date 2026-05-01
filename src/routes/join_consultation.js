const express = require('express')
const { connectToDatabase } = require('../models/db')
const { addStudentToConsultation, JOIN_RESULT_REASONS, searchConsultationsForStudent } = require('../models/consultation_db')

const LOAD_ERROR = 'Unable to load join consultations right now.'
const JOIN_ERROR = 'Unable to join consultation right now.'
const JOIN_ERROR_MESSAGES = {
  [JOIN_RESULT_REASONS.ALREADY_JOINED]: 'You have already joined this consultation.',
  [JOIN_RESULT_REASONS.FULL]: 'This consultation is already full.',
  [JOIN_RESULT_REASONS.NOT_FOUND]: 'Consultation not found.'
}

const router = express.Router()

const renderJoinConsultation = function (res, {
  consultations = [],
  error = '',
  statusCode = 200
} = {}) {
  return res.status(statusCode).render('join_consultation', {
    consultations,
    error
  })
}

router.get('/', async function (req, res) {
  const { username = '' } = req.session?.user || {}

  try {
    await connectToDatabase()
    return renderJoinConsultation(res, {
      consultations: await searchConsultationsForStudent({ username })
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

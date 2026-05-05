jest.mock('../../../src/models/consultation_db', () => ({
  addStudentToConsultation: jest.fn(),
  JOIN_RESULT_REASONS: {
    ALREADY_JOINED: 'already-joined',
    FULL: 'full',
    NOT_FOUND: 'not-found'
  },
  searchConsultationsForStudent: jest.fn()
}))

jest.mock('../../../src/models/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('../../../src/models/user_db', () => ({
  searchLecturers: jest.fn()
}))

jest.mock('../../../src/models/lecturer_availability_db', () => ({
  getLecturerAvailability: jest.fn()
}))

const http = require('node:http')
const path = require('node:path')
const express = require('express')

const { addStudentToConsultation, JOIN_RESULT_REASONS, searchConsultationsForStudent } = require('../../../src/models/consultation_db')
const { connectToDatabase } = require('../../../src/models/db')
const { getLecturerAvailability } = require('../../../src/models/lecturer_availability_db')
const { searchLecturers } = require('../../../src/models/user_db')
const joinConsultationRouter = require('../../../src/routes/join_consultation')

const closeServer = async function (server) {
  if (!server) {
    return
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })

    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections()
    }

    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
  })
}

let currentSessionUser = {
  facultyId: '',
  role: 'student',
  schoolId: '',
  universityId: 'Wits',
  username: 'morris'
}

const createServer = async function () {
  const app = express()
  const server = http.createServer(app)

  app.set('view engine', 'ejs')
  app.set('views', path.resolve(__dirname, '../../../src/views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = { user: currentSessionUser }
    next()
  })
  app.use('/join_consultation', joinConsultationRouter)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return server
}

describe('join consultation route', () => {
  let baseUrl
  let server
  const MONDAY = '2030-05-06'

  const MONDAY_AVAILABILITY = {
    duration: 60,
    exceptionDates: [],
    weeklyAvailability: [{ day: 'monday', startTime: '08:00', endTime: '12:00' }]
  }

  beforeAll(async () => {
    server = await createServer()
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterAll(async () => {
    await closeServer(server)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    currentSessionUser = {
      facultyId: '',
      role: 'student',
      schoolId: '',
      universityId: 'Wits',
      username: 'morris'
    }
    connectToDatabase.mockResolvedValue(undefined)
    searchConsultationsForStudent.mockResolvedValue([])
    searchLecturers.mockResolvedValue([])
    getLecturerAvailability.mockResolvedValue(MONDAY_AVAILABILITY)
    addStudentToConsultation.mockResolvedValue({ success: true })
  })

  test('renders the join consultation page', async () => {
    const response = await fetch(`${baseUrl}/join_consultation`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Join Consultation</title>')
    expect(searchConsultationsForStudent).toHaveBeenCalledWith({
      date: '',
      lecturerId: '',
      time: '',
      username: 'morris'
    })
  })

  test('passes the lecturerId filter to searchConsultationsForStudent', async () => {
    const response = await fetch(`${baseUrl}/join_consultation?lecturerId=lecturer1`)

    expect(response.status).toBe(200)
    expect(searchConsultationsForStudent).toHaveBeenCalledWith({
      date: '',
      lecturerId: 'lecturer1',
      time: '',
      username: 'morris'
    })
  })

  test('passes the date filter to searchConsultationsForStudent', async () => {
    const response = await fetch(`${baseUrl}/join_consultation?date=${MONDAY}`)

    expect(response.status).toBe(200)
    expect(searchConsultationsForStudent).toHaveBeenCalledWith({
      date: MONDAY,
      lecturerId: '',
      time: '',
      username: 'morris'
    })
  })

  test('shows the create empty state when no consultations are found for a valid lecturer and date', async () => {
    const response = await fetch(`${baseUrl}/join_consultation?lecturerId=lecturer1&date=${MONDAY}`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(getLecturerAvailability).toHaveBeenCalledWith('lecturer1')
    expect(body).toContain('No matching consultations')
    expect(body).toContain('lecturerId=lecturer1')
    expect(body).toContain(`date=${MONDAY}`)
  })

  test('includes the time in the create link when a time filter is provided', async () => {
    const response = await fetch(`${baseUrl}/join_consultation?lecturerId=lecturer1&date=${MONDAY}&time=09%3A00`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('time=09%3A00')
  })

  test('shows the violation empty state when the time is outside the lecturer schedule', async () => {
    const response = await fetch(`${baseUrl}/join_consultation?lecturerId=lecturer1&date=${MONDAY}&time=13%3A00`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Violates lecturer preferences')
  })

  test('does not check availability when lecturerId is not provided', async () => {
    const response = await fetch(`${baseUrl}/join_consultation?date=${MONDAY}`)

    expect(response.status).toBe(200)
    expect(getLecturerAvailability).not.toHaveBeenCalled()
  })

  test('returns a server error when loading the page fails', async () => {
    connectToDatabase.mockRejectedValueOnce(new Error('database unavailable'))

    const response = await fetch(`${baseUrl}/join_consultation`)
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Unable to load join consultations right now.')
  })

  test('returns success JSON when joining a consultation succeeds', async () => {
    const response = await fetch(`${baseUrl}/join_consultation/abc123/join`, {
      headers: { accept: 'application/json' },
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
  })

  test('returns error JSON when the consultation is full', async () => {
    addStudentToConsultation.mockResolvedValueOnce({
      reason: JOIN_RESULT_REASONS.FULL,
      statusCode: 400,
      success: false
    })

    const response = await fetch(`${baseUrl}/join_consultation/abc123/join`, {
      headers: { accept: 'application/json' },
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'This consultation is already full.', success: false })
  })

  test('returns error JSON when the student has already joined', async () => {
    addStudentToConsultation.mockResolvedValueOnce({
      reason: JOIN_RESULT_REASONS.ALREADY_JOINED,
      statusCode: 400,
      success: false
    })

    const response = await fetch(`${baseUrl}/join_consultation/abc123/join`, {
      headers: { accept: 'application/json' },
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'You have already joined this consultation.', success: false })
  })

  test('returns error JSON when the consultation is not found', async () => {
    addStudentToConsultation.mockResolvedValueOnce({
      reason: JOIN_RESULT_REASONS.NOT_FOUND,
      statusCode: 404,
      success: false
    })

    const response = await fetch(`${baseUrl}/join_consultation/abc123/join`, {
      headers: { accept: 'application/json' },
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({ error: 'Consultation not found.', success: false })
  })

  test('returns a server error when joining fails', async () => {
    addStudentToConsultation.mockRejectedValueOnce(new Error('database unavailable'))

    const response = await fetch(`${baseUrl}/join_consultation/abc123/join`, {
      headers: { accept: 'application/json' },
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Unable to join consultation right now.', success: false })
  })
})

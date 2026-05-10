jest.mock('../../../src/models/consultation_db', () => ({
  addConsultation: jest.fn(),
  cancelConsultation: jest.fn(),
  getConsultationsForStudent: jest.fn(),
  listConsultationsForLecturerOnDate: jest.fn()
}))

jest.mock('../../../src/models/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('../../../src/models/user_db', () => ({
  getUser: jest.fn(),
  searchLecturers: jest.fn()
}))

jest.mock('../../../src/models/lecturer_availability_db', () => ({
  getLecturerAvailability: jest.fn()
}))

const http = require('node:http')
const path = require('node:path')
const express = require('express')

const { addConsultation, cancelConsultation, getConsultationsForStudent, listConsultationsForLecturerOnDate } = require('../../../src/models/consultation_db')
const { connectToDatabase } = require('../../../src/models/db')
const { getLecturerAvailability } = require('../../../src/models/lecturer_availability_db')
const { getUser, searchLecturers } = require('../../../src/models/user_db')
const consultationsRouter = require('../../../src/routes/consultations')

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

/**
 * Encodes form fields for URL-encoded POST requests.
 * @param {Record<string, string>} fields - Form fields to encode.
 * @returns {string} URL-encoded form payload.
 */
const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

let currentSessionUser = {
  role: 'student',
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
    req.session = {
      user: currentSessionUser
    }
    next()
  })
  app.use('/consultations', consultationsRouter)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return server
}

describe('consultations route', () => {
  let baseUrl
  let server
  const MONDAY_DATETIME = '2030-05-06T09:00'

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
      role: 'student',
      universityId: 'Wits',
      username: 'morris'
    }
    addConsultation.mockResolvedValue({ acknowledged: true, insertedId: 'consultation-id' })
    cancelConsultation.mockResolvedValue({ success: true })
    getConsultationsForStudent.mockResolvedValue([])
    listConsultationsForLecturerOnDate.mockResolvedValue([])
    connectToDatabase.mockResolvedValue(undefined)
    getLecturerAvailability.mockResolvedValue({
      dailyMax: 2,
      duration: 60,
      exceptionDates: [],
      weeklyAvailability: [{ day: 'monday', startTime: '08:00', endTime: '12:00' }]
    })
    getUser.mockResolvedValue({ role: 'lecturer', universityId: 'Wits', username: 'lecturer1' })
    searchLecturers.mockResolvedValue([{ firstName: 'Alice', lastName: 'Smith', username: 'lecturer1' }])
  })

  test('renders the create consultation form', async () => {
    const response = await fetch(`${baseUrl}/consultations/new`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Create Consultation</title>')
    expect(body).toContain('Alice Smith')
    expect(searchLecturers).toHaveBeenCalledWith({ universityId: 'Wits' })
  })

  test('returns forbidden when a non-student requests the create consultation form', async () => {
    currentSessionUser = {
      role: 'lecturer',
      universityId: 'Wits',
      username: 'lecturer1'
    }

    const response = await fetch(`${baseUrl}/consultations/new`)
    const body = await response.text()

    expect(response.status).toBe(403)
    expect(body).toContain('Only students can create consultations.')
    expect(searchLecturers).not.toHaveBeenCalled()
  })

  test('returns a server error when the create consultation form cannot load', async () => {
    connectToDatabase.mockRejectedValueOnce(new Error('database unavailable'))

    const response = await fetch(`${baseUrl}/consultations/new`)
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Unable to load the consultation form right now.')
  })

  test('creates a consultation and redirects to home', async () => {
    const response = await fetch(`${baseUrl}/consultations`, {
      body: encodeForm({
        datetime: MONDAY_DATETIME,
        lecturerId: 'lecturer1',
        title: 'Project check-in'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')
    expect(getUser).toHaveBeenCalledWith('lecturer1')
    expect(addConsultation).toHaveBeenCalledWith({
      attendees: ['morris'],
      capacity: 1,
      datetime: MONDAY_DATETIME,
      lecturerId: 'lecturer1',
      organiserId: 'morris',
      title: 'Project check-in'
    })
  })

  test('returns forbidden when a non-student submits a consultation', async () => {
    currentSessionUser = {
      role: 'lecturer',
      universityId: 'Wits',
      username: 'lecturer1'
    }

    const response = await fetch(`${baseUrl}/consultations`, {
      body: encodeForm({
        datetime: MONDAY_DATETIME,
        lecturerId: 'lecturer2',
        title: 'Project check-in'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.text()

    expect(response.status).toBe(403)
    expect(body).toContain('Only students can create consultations.')
    expect(addConsultation).not.toHaveBeenCalled()
  })

  test('re-renders the form when submitted fields are invalid', async () => {
    const response = await fetch(`${baseUrl}/consultations`, {
      body: encodeForm({
        datetime: 'not-a-date',
        lecturerId: 'lecturer1',
        title: ''
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.text()

    expect(response.status).toBe(400)
    expect(body).toContain('Please complete all consultation fields with a valid date and time.')
    expect(addConsultation).not.toHaveBeenCalled()
  })

  test('re-renders the form when the lecturer is invalid', async () => {
    getUser.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/consultations`, {
      body: encodeForm({
        datetime: MONDAY_DATETIME,
        lecturerId: 'lecturer1',
        title: 'Project check-in'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.text()

    expect(response.status).toBe(400)
    expect(body).toContain('Please select a valid lecturer.')
    expect(addConsultation).not.toHaveBeenCalled()
  })

  test('re-renders the form when the lecturer belongs to a different university', async () => {
    getUser.mockResolvedValue({ role: 'lecturer', universityId: 'OtherUni', username: 'lecturer1' })

    const response = await fetch(`${baseUrl}/consultations`, {
      body: encodeForm({
        datetime: MONDAY_DATETIME,
        lecturerId: 'lecturer1',
        title: 'Project check-in'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.text()

    expect(response.status).toBe(400)
    expect(body).toContain('Please select a valid lecturer.')
    expect(addConsultation).not.toHaveBeenCalled()
  })

  describe('GET /consultations', () => {
    test('returns JSON list of the students consultations', async () => {
      const consultations = [
        { id: 'abc123', name: 'Project check-in', lecturer: 'Alice Smith', date: '2030-05-06', time: '09:00', isOrganiser: true }
      ]
      getConsultationsForStudent.mockResolvedValue(consultations)

      const response = await fetch(`${baseUrl}/consultations`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.consultations).toEqual(consultations)
      expect(getConsultationsForStudent).toHaveBeenCalledWith('morris')
    })

    test('returns 403 when an unauthorized role requests the consultation list', async () => {
      currentSessionUser = { role: 'guest', universityId: 'Wits', username: 'guest1' }

      const response = await fetch(`${baseUrl}/consultations`)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBeDefined()
      expect(getConsultationsForStudent).not.toHaveBeenCalled()
    })

    test('returns 500 when the database fails', async () => {
      connectToDatabase.mockRejectedValueOnce(new Error('database unavailable'))

      const response = await fetch(`${baseUrl}/consultations`)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })

  describe('DELETE /consultations/:id', () => {
    test('returns success when cancellation succeeds', async () => {
      const response = await fetch(`${baseUrl}/consultations/abc123`, { method: 'DELETE' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(cancelConsultation).toHaveBeenCalledWith('abc123', 'morris', 'student')
    })

    test('returns 403 when an unauthorized role tries to cancel', async () => {
      currentSessionUser = { role: 'guest', universityId: 'Wits', username: 'guest1' }

      const response = await fetch(`${baseUrl}/consultations/abc123`, { method: 'DELETE' })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBeDefined()
      expect(cancelConsultation).not.toHaveBeenCalled()
    })

    test('returns 404 when the consultation is not found', async () => {
      cancelConsultation.mockResolvedValue({ success: false, statusCode: 404, reason: 'not-found' })

      const response = await fetch(`${baseUrl}/consultations/abc123`, { method: 'DELETE' })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Consultation not found.')
    })

    test('returns 403 when the student is not the organiser', async () => {
      cancelConsultation.mockResolvedValue({ success: false, statusCode: 403, reason: 'not-organiser' })

      const response = await fetch(`${baseUrl}/consultations/abc123`, { method: 'DELETE' })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Only the organiser can cancel this consultation.')
    })

    test('returns 400 when the consultation is in the past', async () => {
      cancelConsultation.mockResolvedValue({ success: false, statusCode: 400, reason: 'past-consultation' })

      const response = await fetch(`${baseUrl}/consultations/abc123`, { method: 'DELETE' })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Past consultations cannot be cancelled.')
    })

    test('returns 500 when the database throws', async () => {
      connectToDatabase.mockRejectedValueOnce(new Error('database unavailable'))

      const response = await fetch(`${baseUrl}/consultations/abc123`, { method: 'DELETE' })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })
  })

  test('re-renders the form when saving the consultation fails', async () => {
    addConsultation.mockRejectedValueOnce(new Error('database unavailable'))

    const response = await fetch(`${baseUrl}/consultations`, {
      body: encodeForm({
        datetime: MONDAY_DATETIME,
        lecturerId: 'lecturer1',
        title: 'Project check-in'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Unable to create the consultation right now.')
    expect(searchLecturers).toHaveBeenCalledWith({ universityId: 'Wits' })
  })
})

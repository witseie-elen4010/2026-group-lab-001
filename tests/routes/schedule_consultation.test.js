jest.mock('../../src/models/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}))
// only available to students
jest.mock('../../src/models/lecturer_availability_db', () => ({
  getLecturerAvailability: jest.fn()
}))

const http = require('node:http')
const path = require('node:path')
const express = require('express')

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

const { connectToDatabase } = require('../../src/models/db')
const { getLecturerAvailability } = require('../../src/models/lecturer_availability_db')
const scheduleConsultationRouter = require('../../src/routes/schedule_consultation')

const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

const createServer = async function () {
  const app = express()
  const server = http.createServer(app)

  app.set('view engine', 'ejs')
  app.set('views', path.resolve(__dirname, '../../src/views'))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = {
      user: {
        username: 'morris'
      }
    }
    next()
  })
  app.use('/schedule_consultation', scheduleConsultationRouter)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return server
}

describe('schedule consultation route', () => {
  let baseUrl
  let server

  beforeAll(async () => {
    server = await createServer()
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterAll(async () => {
    await closeServer(server)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    connectToDatabase.mockResolvedValue(undefined)
    getLecturerAvailability.mockResolvedValue(null)
  })

  test('renders the placeholder page for GET requests', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`)
    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('<title>Schedule a Consultation</title>')
    expect(body).toContain('Hello morris')
    expect(body).toContain('Scheduling a consultation has not been built yet.')
  })

  test('rejects invalid request bodies', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      body: encodeForm({
        date: '2026-05-04',
        endTime: '10:00',
        lecturer: '',
        startTime: '09:00'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      error: 'Invalid input. Provide lecturer, date, startTime, endTime.',
      success: false
    })
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('rejects requests for lecturers without availability', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      body: encodeForm({
        date: '2026-05-04',
        endTime: '10:00',
        lecturer: 'lecturer1',
        startTime: '09:00'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Lecturer has not set availability.')
  })

  test('rejects requests on unavailable exception dates', async () => {
    getLecturerAvailability.mockResolvedValue({
      exceptionDates: ['2026-05-04'],
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }]
    })

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      body: encodeForm({
        date: '2026-05-04',
        endTime: '10:00',
        lecturer: 'lecturer1',
        startTime: '09:00'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Lecturer is unavailable on this date.')
  })

  test('rejects calendar-invalid ISO dates', async () => {
    getLecturerAvailability.mockResolvedValue({
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }]
    })

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      body: encodeForm({
        date: '2026-13-01',
        endTime: '10:00',
        lecturer: 'lecturer1',
        startTime: '09:00'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid date.')
  })

  test('rejects requests outside the lecturer availability window', async () => {
    getLecturerAvailability.mockResolvedValue({
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }]
    })

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      body: encodeForm({
        date: '2026-05-04',
        endTime: '10:00',
        lecturer: 'lecturer1',
        startTime: '08:30'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Requested time is outside lecturer availability.')
  })

  test('accepts requests within the lecturer availability window', async () => {
    getLecturerAvailability.mockResolvedValue({
      weeklyAvailability: [
        null,
        { day: 'monday', startTime: '09:00', endTime: '12:00' },
        { day: 'monday', startTime: 'invalid', endTime: '13:00' }
      ]
    })

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      body: encodeForm({
        date: '2026-05-04',
        endTime: '10:30',
        lecturer: 'lecturer1',
        startTime: '09:30'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      message: 'Requested slot is available.',
      success: true
    })
  })

  test('returns a server error when availability lookup fails', async () => {
    connectToDatabase.mockRejectedValue(new Error('database unavailable'))

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      body: encodeForm({
        date: '2026-05-04',
        endTime: '10:00',
        lecturer: 'lecturer1',
        startTime: '09:00'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Server error while checking availability.')
  })
})

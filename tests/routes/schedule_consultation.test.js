jest.mock('../../src/models/db', () => ({
  connectToDatabase: jest.fn()
}))

jest.mock('../../src/models/lecturer_availability_db', () => ({
  getLecturerAvailability: jest.fn()
}))

const http = require('node:http')
const path = require('node:path')
const express = require('express')

const { connectToDatabase } = require('../../src/models/db')
const { getLecturerAvailability } = require('../../src/models/lecturer_availability_db')
const scheduleConsultationRouter = require('../../src/routes/schedule_consultation')

const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

describe('schedule consultation route', () => {
  let server
  let baseUrl
  let sessionState

  beforeAll(async () => {
    const app = express()

    app.set('view engine', 'ejs')
    app.set('views', path.join(__dirname, '../../src/views'))
    app.use(express.urlencoded({ extended: true }))
    app.use(function (req, res, next) {
      req.session = sessionState
      next()
    })
    app.use('/schedule_consultation', scheduleConsultationRouter)

    server = http.createServer(app)
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    sessionState = {}
    connectToDatabase.mockResolvedValue(undefined)
    getLecturerAvailability.mockResolvedValue({
      exceptionDates: [],
      weeklyAvailability: [
        { day: 'monday', startTime: '09:00', endTime: '11:00' }
      ]
    })
  })

  test('renders the placeholder page with the current username', async () => {
    sessionState = {
      user: {
        username: 'alice'
      }
    }

    const response = await fetch(`${baseUrl}/schedule_consultation`)
    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('Scheduling a consultation has not been built yet.')
    expect(body).toContain('alice')
  })

  test('rejects invalid input before checking availability', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        lecturer: '',
        date: '2026-05-04',
        startTime: '09:00',
        endTime: '10:00'
      })
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid input. Provide lecturer, date, startTime, endTime.'
    })
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(getLecturerAvailability).not.toHaveBeenCalled()
  })

  test('reports when the lecturer has not set availability', async () => {
    getLecturerAvailability.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        lecturer: 'alice',
        date: '2026-05-04',
        startTime: '09:00',
        endTime: '10:00'
      })
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Lecturer has not set availability.'
    })
  })

  test('rejects a date listed in the lecturer exception dates', async () => {
    getLecturerAvailability.mockResolvedValue({
      exceptionDates: ['2026-05-04'],
      weeklyAvailability: [
        { day: 'monday', startTime: '09:00', endTime: '11:00' }
      ]
    })

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        lecturer: 'alice',
        date: '2026-05-04',
        startTime: '09:00',
        endTime: '10:00'
      })
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Lecturer is unavailable on this date.'
    })
  })

  test('rejects an invalid ISO date even when the format matches', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        lecturer: 'alice',
        date: '2026-13-01',
        startTime: '09:00',
        endTime: '10:00'
      })
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid date.'
    })
  })

  test('rejects requested times outside lecturer availability', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        lecturer: 'alice',
        date: '2026-05-04',
        startTime: '08:30',
        endTime: '09:15'
      })
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Requested time is outside lecturer availability.'
    })
  })

  test('accepts an available slot and ignores malformed weekly availability entries', async () => {
    getLecturerAvailability.mockResolvedValue({
      exceptionDates: [],
      weeklyAvailability: [
        null,
        { day: 'monday', startTime: 'bad', endTime: '11:00' },
        { day: 'tuesday', startTime: '09:00', endTime: '11:00' },
        { day: 'monday', startTime: '09:00', endTime: '11:00' }
      ]
    })

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        username: 'alice',
        date: '2026-05-04',
        startTime: '09:15',
        endTime: '10:30'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'Requested slot is available.'
    })
    expect(getLecturerAvailability).toHaveBeenCalledWith('alice')
  })

  test('returns a server error when availability lookup fails', async () => {
    connectToDatabase.mockRejectedValue(new Error('database unavailable'))

    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        lecturer: 'alice',
        date: '2026-05-04',
        startTime: '09:00',
        endTime: '10:00'
      })
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Server error while checking availability.'
    })
  })
})

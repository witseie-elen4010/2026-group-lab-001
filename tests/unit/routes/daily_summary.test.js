'use strict'

jest.mock('../../../src/models/consultation_db', () => ({
  addConsultation: jest.fn(),
  cancelConsultation: jest.fn(),
  getDailyConsultationsForLecturer: jest.fn(),
  JOIN_RESULT_REASONS: {
    ALREADY_JOINED: 'already-joined',
    FULL: 'full',
    NOT_FOUND: 'not-found'
  }
}))

jest.mock('../../../src/models/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const http = require('node:http')
const path = require('node:path')
const express = require('express')

const { getDailyConsultationsForLecturer } = require('../../../src/models/consultation_db')
const { connectToDatabase } = require('../../../src/models/db')
const { router: dailySummaryRouter, groupConsultationsByTimeSlot, getTodayIsoDate } = require('../../../src/routes/daily_summary')

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
  role: 'lecturer',
  username: 'lecturer1'
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
  app.use('/daily_summary', dailySummaryRouter)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return server
}

describe('daily_summary route', () => {
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
    currentSessionUser = { role: 'lecturer', username: 'lecturer1' }
    connectToDatabase.mockResolvedValue(undefined)
    getDailyConsultationsForLecturer.mockResolvedValue([])
  })

  test('renders an empty daily summary for a lecturer with no consultations today', async () => {
    const response = await fetch(`${baseUrl}/daily_summary`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Daily Summary</title>')
    expect(body).toContain('No consultations scheduled for today.')
    expect(getDailyConsultationsForLecturer).toHaveBeenCalledWith('lecturer1', getTodayIsoDate())
  })

  test('renders consultations grouped by time slot', async () => {
    getDailyConsultationsForLecturer.mockResolvedValue([
      {
        attendeesCount: 1,
        capacity: 2,
        id: 'c1',
        name: 'Algebra Help',
        organiser: 'student1',
        roster: ['Alice Smith'],
        startTime: '09:00',
        time: '09:00 to 10:00'
      },
      {
        attendeesCount: 0,
        capacity: 3,
        id: 'c2',
        name: 'Calculus Review',
        organiser: 'student2',
        roster: [],
        startTime: '09:00',
        time: '09:00 to 10:00'
      },
      {
        attendeesCount: 2,
        capacity: 5,
        id: 'c3',
        name: 'Physics Q&A',
        organiser: 'student3',
        roster: ['Bob Jones', 'Carol White'],
        startTime: '14:00',
        time: '14:00 to 15:00'
      }
    ])

    const response = await fetch(`${baseUrl}/daily_summary`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Algebra Help')
    expect(body).toContain('Calculus Review')
    expect(body).toContain('Physics Q&amp;A')
    expect(body).toContain('09:00')
    expect(body).toContain('14:00')
    expect(body).toContain('Alice Smith')
    expect(body).toContain('Bob Jones')
    expect(body).toContain('Carol White')
    expect(body).toContain('No confirmed students booked for this session yet.')
  })

  test('returns 403 when a non-lecturer accesses the daily summary', async () => {
    currentSessionUser = { role: 'student', username: 'studentuser' }

    const response = await fetch(`${baseUrl}/daily_summary`)
    const body = await response.text()

    expect(response.status).toBe(403)
    expect(body).toContain('Only lecturers can access the daily summary.')
    expect(getDailyConsultationsForLecturer).not.toHaveBeenCalled()
  })

  test('returns 403 when an admin accesses the daily summary', async () => {
    currentSessionUser = { role: 'admin', username: 'adminuser' }

    const response = await fetch(`${baseUrl}/daily_summary`)
    const body = await response.text()

    expect(response.status).toBe(403)
    expect(body).toContain('Only lecturers can access the daily summary.')
  })

  test('returns 500 when the database call fails', async () => {
    connectToDatabase.mockRejectedValueOnce(new Error('connection refused'))

    const response = await fetch(`${baseUrl}/daily_summary`)
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Unable to load daily summary right now.')
  })

  test('shows the today date label on the page', async () => {
    const response = await fetch(`${baseUrl}/daily_summary`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('daily_summary_date')
  })

  test('shows a back link to home', async () => {
    const response = await fetch(`${baseUrl}/daily_summary`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('href="/home"')
  })
})

describe('groupConsultationsByTimeSlot', () => {
  test('returns an empty array for empty input', () => {
    expect(groupConsultationsByTimeSlot([])).toEqual([])
  })

  test('groups consultations by startTime', () => {
    const consultations = [
      { id: '1', name: 'A', startTime: '10:00' },
      { id: '2', name: 'B', startTime: '10:00' },
      { id: '3', name: 'C', startTime: '09:00' }
    ]

    const result = groupConsultationsByTimeSlot(consultations)

    expect(result).toHaveLength(2)
    expect(result[0].timeSlot).toBe('09:00')
    expect(result[0].consultations).toHaveLength(1)
    expect(result[0].consultations[0].name).toBe('C')
    expect(result[1].timeSlot).toBe('10:00')
    expect(result[1].consultations).toHaveLength(2)
  })

  test('sorts time slots in ascending order', () => {
    const consultations = [
      { id: '1', name: 'Late', startTime: '15:00' },
      { id: '2', name: 'Early', startTime: '08:00' },
      { id: '3', name: 'Mid', startTime: '11:30' }
    ]

    const result = groupConsultationsByTimeSlot(consultations)

    expect(result[0].timeSlot).toBe('08:00')
    expect(result[1].timeSlot).toBe('11:30')
    expect(result[2].timeSlot).toBe('15:00')
  })

  test('uses Unknown for consultations with no startTime', () => {
    const consultations = [{ id: '1', name: 'No Time', startTime: '' }]

    const result = groupConsultationsByTimeSlot(consultations)

    expect(result[0].timeSlot).toBe('Unknown')
  })
})

describe('getTodayIsoDate', () => {
  test('returns a string matching YYYY-MM-DD format', () => {
    const result = getTodayIsoDate()

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('returns the current date', () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    expect(getTodayIsoDate()).toBe(expected)
  })
})

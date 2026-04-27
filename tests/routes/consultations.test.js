jest.mock('../../src/models/consultation_db', () => ({
  addConsultation: jest.fn()
}))

jest.mock('../../src/models/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('../../src/models/user_db', () => ({
  getUser: jest.fn(),
  searchLecturers: jest.fn()
}))

const http = require('node:http')
const path = require('node:path')
const express = require('express')

const { addConsultation } = require('../../src/models/consultation_db')
const { connectToDatabase } = require('../../src/models/db')
const { getUser, searchLecturers } = require('../../src/models/user_db')
const consultationsRouter = require('../../src/routes/consultations')

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

const createServer = async function () {
  const app = express()
  const server = http.createServer(app)

  app.set('view engine', 'ejs')
  app.set('views', path.resolve(__dirname, '../../src/views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = {
      user: {
        role: 'student',
        universityId: 'Wits',
        username: 'morris'
      }
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

  beforeAll(async () => {
    server = await createServer()
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterAll(async () => {
    await closeServer(server)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    addConsultation.mockResolvedValue({ acknowledged: true, insertedId: 'consultation-id' })
    connectToDatabase.mockResolvedValue(undefined)
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

  test('creates a consultation and redirects to home', async () => {
    const response = await fetch(`${baseUrl}/consultations`, {
      body: encodeForm({
        datetime: '2026-05-04T09:00',
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
      datetime: '2026-05-04T09:00',
      lecturerId: 'lecturer1',
      organiserId: 'morris',
      title: 'Project check-in'
    })
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
        datetime: '2026-05-04T09:00',
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
})

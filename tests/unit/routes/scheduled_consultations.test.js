'use strict'

jest.mock('../../../src/models/consultation_db', () => ({
  getUpcomingConsultationsForLecturer: jest.fn()
}))

jest.mock('../../../src/models/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}))

const http = require('node:http')
const path = require('node:path')
const express = require('express')

const { getUpcomingConsultationsForLecturer } = require('../../../src/models/consultation_db')
const { connectToDatabase } = require('../../../src/models/db')
const scheduledConsultationsRouter = require('../../../src/routes/scheduled_consultations')

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
  app.use((req, res, next) => {
    req.session = {
      user: currentSessionUser
    }
    next()
  })
  app.use('/scheduled_consultations', scheduledConsultationsRouter)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return server
}

describe('scheduled_consultations route', () => {
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
    currentSessionUser = {
      role: 'lecturer',
      username: 'lecturer1'
    }
    connectToDatabase.mockResolvedValue(undefined)
    getUpcomingConsultationsForLecturer.mockResolvedValue([])
  })

  test('renders a cancel button for each consultation card', async () => {
    getUpcomingConsultationsForLecturer.mockResolvedValue([
      {
        date: '2030-05-06',
        id: 'abc123',
        name: 'Project check-in',
        organiser: 'Morris Molefe',
        roster: ['Morris Molefe'],
        time: '09:00 to 10:00'
      }
    ])

    const response = await fetch(`${baseUrl}/scheduled_consultations`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Cancel')
    expect(body).toContain('data-cancel-id="abc123"')
    expect(body).toContain('/scripts/scheduled_consultations.js')
    expect(body).toContain('id="scheduled_consultations_msg"')
  })

  test('returns 403 when a non-lecturer accesses the dashboard', async () => {
    currentSessionUser = {
      role: 'student',
      username: 'student1'
    }

    const response = await fetch(`${baseUrl}/scheduled_consultations`)
    const body = await response.text()

    expect(response.status).toBe(403)
    expect(getUpcomingConsultationsForLecturer).not.toHaveBeenCalled()
  })
})

jest.mock('../../../src/models/consultation_db', () => ({
  addConsultation: jest.fn()
}))

jest.mock('../../../src/models/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('../../../src/models/user_db', () => ({
  getUser: jest.fn(),
  searchLecturers: jest.fn()
}))

const http = require('node:http')
const path = require('node:path')
const express = require('express')

const { searchLecturers } = require('../../../src/models/user_db')
const consultationsRouter = require('../../../src/routes/consultations')

const createServer = async function () {
  const app = express()
  const server = http.createServer(app)

  app.set('view engine', 'ejs')
  app.set('views', path.resolve(__dirname, '../../../src/views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = {
      user: { role: 'student', universityId: 'Wits', username: 'morris' }
    }
    next()
  })
  app.use('/consultations', consultationsRouter)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return server
}

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

describe('create consultation form structure', () => {
  let server
  let baseUrl

  beforeAll(async () => {
    server = await createServer()
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterAll(async () => {
    await closeServer(server)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    searchLecturers.mockResolvedValue([{ firstName: 'Alice', lastName: 'Smith', username: 'lecturer1' }])
  })

  test('create consultation form contains expected fields and lecturer option', async () => {
    const response = await fetch(`${baseUrl}/consultations/new`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Create Consultation</title>')
    expect(body).toContain('name="title"')
    expect(body).toContain('name="lecturerId"')
    expect(body).toContain('name="datetime"')
    expect(body).toContain('name="capacity"')
    expect(body).toContain('Create Consultation')
    expect(body).toContain('Alice Smith')
  })

  test('create consultation form capacity input has a default value of 1 and minimum of 1', async () => {
    const response = await fetch(`${baseUrl}/consultations/new`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('name="capacity"')
    expect(body).toContain('min="1"')
    expect(body).toContain('value="1"')
  })
})

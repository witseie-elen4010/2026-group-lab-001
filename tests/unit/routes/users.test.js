jest.mock('../../../src/models/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('../../../src/models/user_db', () => ({
  followLecturer: jest.fn(),
  getUser: jest.fn()
}))

const http = require('node:http')
const express = require('express')

const { connectToDatabase } = require('../../../src/models/db')
const requireAuthentication = require('../../../src/middleware/require_authentication')
const { followLecturer, getUser } = require('../../../src/models/user_db')
const usersRouter = require('../../../src/routes/users')

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
  role: 'student',
  universityId: 'Wits',
  username: 'morris'
}

let currentSession = {
  user: currentSessionUser
}

const createServer = async function () {
  const app = express()
  const server = http.createServer(app)

  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = currentSession

    next()
  })
  app.use('/users', requireAuthentication, usersRouter)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return server
}

describe('users route', () => {
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
      role: 'student',
      universityId: 'Wits',
      username: 'morris'
    }
    currentSession = { user: currentSessionUser }
    connectToDatabase.mockResolvedValue(undefined)
    getUser.mockResolvedValue({ firstName: 'Alice', lastName: 'Smith', role: 'lecturer', universityId: 'Wits', username: 'lecturer1' })
    followLecturer.mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 })
  })

  test('redirects unauthenticated users to login', async () => {
    currentSessionUser = null
    currentSession = {}

    const response = await fetch(`${baseUrl}/users/lecturer1/follow`, {
      method: 'POST',
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('returns an autofill template for a known Wits degree', async () => {
    const response = await fetch(`${baseUrl}/users/academic-template?degree=${encodeURIComponent('BSc (Eng) - Electrical Engineering')}`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(expect.objectContaining({
      matched: true,
      template: expect.objectContaining({
        coursePrefixes: expect.arrayContaining(['ELEN']),
        courses: expect.arrayContaining(['ELEN Circuit Theory', 'ELEN Electronics']),
        degreeName: 'Electrical Engineering',
        faculty: 'Engineering and the Built Environment'
      })
    }))
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('returns no template when the degree query is blank or unknown', async () => {
    const blankResponse = await fetch(`${baseUrl}/users/academic-template`)
    const blankData = await blankResponse.json()

    expect(blankResponse.status).toBe(200)
    expect(blankData).toEqual({ matched: false, template: null })

    const unknownResponse = await fetch(`${baseUrl}/users/academic-template?degree=${encodeURIComponent('Bachelor of Portal Magic')}`)
    const unknownData = await unknownResponse.json()

    expect(unknownResponse.status).toBe(200)
    expect(unknownData).toEqual({ matched: false, template: null })
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('rejects authenticated non-student users', async () => {
    currentSessionUser = {
      role: 'lecturer',
      universityId: 'Wits',
      username: 'lecturer2'
    }
    currentSession = { user: currentSessionUser }

    const response = await fetch(`${baseUrl}/users/lecturer1/follow`, {
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data).toEqual({ error: 'Only students can follow lecturers.', success: false })
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('rejects targets that are not valid lecturers for the student university', async () => {
    getUser.mockResolvedValueOnce({ role: 'lecturer', universityId: 'OtherUni', username: 'lecturer1' })

    const response = await fetch(`${baseUrl}/users/lecturer1/follow`, {
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({ error: 'Please select a valid lecturer.', success: false })
    expect(followLecturer).not.toHaveBeenCalled()
  })

  test('persists a lecturer follow for an authenticated student', async () => {
    const response = await fetch(`${baseUrl}/users/lecturer1/follow`, {
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ alreadyFollowing: false, success: true })
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledWith('lecturer1')
    expect(followLecturer).toHaveBeenCalledWith('morris', 'lecturer1')
  })

  test('returns success when the lecturer is already followed', async () => {
    followLecturer.mockResolvedValueOnce({ acknowledged: true, matchedCount: 1, modifiedCount: 0 })

    const response = await fetch(`${baseUrl}/users/lecturer1/follow`, {
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ alreadyFollowing: true, success: true })
  })

  test('redirects HTML follow submissions back to home with a success flash message', async () => {
    const response = await fetch(`${baseUrl}/users/lecturer1/follow`, {
      headers: { accept: 'text/html' },
      method: 'POST',
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')
    expect(currentSession.flash).toEqual({ success: 'You are now following Alice Smith.' })
  })
})

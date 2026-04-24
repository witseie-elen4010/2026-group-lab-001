jest.mock('../../src/models/db', () => ({
  closeDatabaseConnection: jest.fn(),
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
  DATABASE_NAME: 'LetsTalk',
  getCollection: jest.fn(),
  getDb: jest.fn(),
  getMongoUri: jest.fn()
}))

jest.mock('../../src/models/user_db', () => ({
  addUser: jest.fn(),
  deleteUser: jest.fn(),
  getUser: jest.fn(),
  searchLecturers: jest.fn()
}))

const http = require('node:http')
const { connectToDatabase } = require('../../src/models/db')
const { getUser } = require('../../src/models/user_db')
const { setSession } = require('../../src/utils/session')
const app = require('../../src/app')

/**
 * Captures the Set-Cookie header written by setSession and returns the name=value portion.
 * @param {object} data - Session payload to encode.
 * @returns {string} The cookie name=value pair ready to use as a Cookie request header.
 */
const buildSessionCookie = function (data) {
  let cookieHeader
  setSession({ setHeader: (_name, value) => { cookieHeader = value } }, data)
  return cookieHeader.split(';')[0]
}

const MOCK_SESSION = { username: 'testuser', universityId: 'wits', role: 'student' }

const MOCK_LECTURER = {
  username: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  role: 'lecturer',
  universityId: 'wits',
  facultyId: 'Engineering',
  schoolId: 'EIE'
}

describe('lecturer route', () => {
  let server
  let baseUrl
  let sessionCookie

  beforeAll(async () => {
    server = http.createServer(app)
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
    sessionCookie = buildSessionCookie(MOCK_SESSION)
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
    connectToDatabase.mockResolvedValue(undefined)
    getUser.mockResolvedValue(MOCK_LECTURER)
  })

  test('Redirects to login when no session cookie is present', async () => {
    const response = await fetch(`${baseUrl}/lecturer/alice`, { redirect: 'manual' })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('Renders the lecturer profile page for a valid lecturer username', async () => {
    const response = await fetch(`${baseUrl}/lecturer/alice`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledWith('alice')
    expect(body).toContain('Alice Smith')
    expect(body).toContain('@alice')
  })

  test('Returns 404 when the username does not exist', async () => {
    getUser.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/lecturer/unknown`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(404)
    expect(body).toContain('Lecturer not found.')
  })

  test('Returns 404 when the user exists but is not a lecturer', async () => {
    getUser.mockResolvedValue({ ...MOCK_LECTURER, role: 'student' })

    const response = await fetch(`${baseUrl}/lecturer/alice`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(404)
    expect(body).toContain('Lecturer not found.')
  })

  test('Returns 500 when the database throws', async () => {
    connectToDatabase.mockRejectedValue(new Error('DB error'))

    const response = await fetch(`${baseUrl}/lecturer/alice`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Lecturer not found.')
  })
})

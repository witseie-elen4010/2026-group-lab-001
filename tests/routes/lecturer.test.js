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
const { getUser, searchLecturers } = require('../../src/models/user_db')
const { hashPassword } = require('../../src/utils/password')
const app = require('../../src/app')

const MOCK_LECTURER = {
  username: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  role: 'lecturer',
  universityId: 'wits',
  facultyId: 'Engineering',
  schoolId: 'EIE'
}

/**
 * Encodes form fields for URL-encoded POST requests.
 * @param {Record<string, string>} fields - Form fields to encode.
 * @returns {string} URL-encoded form payload.
 */
const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

/**
 * Extracts the session cookie value from a Set-Cookie header.
 * @param {string|null} setCookieHeader - Raw Set-Cookie header value.
 * @returns {string} Session cookie header value.
 */
const getSessionCookie = function (setCookieHeader) {
  return setCookieHeader?.split(';')[0] || ''
}

/**
 * Logs in and returns the session cookie for protected route tests.
 * @param {object} options - Login user details.
 * @param {string} [options.role='student'] - User role to store in the session.
 * @param {string} [options.username='testuser'] - Username used for login.
 * @returns {Promise<{loginResponse: Response, sessionCookie: string}>} Login response and session cookie.
 */
const loginAs = async function ({ role = 'student', username = 'testuser' } = {}) {
  getUser.mockResolvedValueOnce({
    passwordHash: await hashPassword('welovesd3'),
    role,
    username
  })

  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: encodeForm({ password: 'welovesd3', username }),
    redirect: 'manual'
  })

  return {
    loginResponse,
    sessionCookie: getSessionCookie(loginResponse.headers.get('set-cookie'))
  }
}

let baseUrl

describe('lecturer route', () => {
  let server
  let sessionCookie

  beforeAll(async () => {
    server = http.createServer(app)
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
    ;({ sessionCookie } = await loginAs({ role: 'student', username: 'testuser' }))
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
    searchLecturers.mockResolvedValue([])
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

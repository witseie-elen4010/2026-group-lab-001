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
  getUser: jest.fn()
}))

const http = require('node:http')

const { getUser } = require('../../src/models/user_db')
const { hashPassword } = require('../../src/utils/password')
const app = require('../../src/app')

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

describe('home route', () => {
  let server
  let baseUrl

  beforeAll(async () => {
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
  })

  test('Renders the student home page after a successful login', async () => {
    getUser.mockResolvedValue({
      passwordHash: await hashPassword('welovesd3'),
      role: 'student',
      username: 'morris'
    })

    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        password: 'welovesd3',
        username: 'morris'
      }),
      redirect: 'manual'
    })

    const sessionCookie = getSessionCookie(loginResponse.headers.get('set-cookie'))
    const response = await fetch(`${baseUrl}/home`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(loginResponse.status).toBe(302)
    expect(loginResponse.headers.get('location')).toBe('/home')
    expect(response.status).toBe(200)
    expect(body).toContain('<title>Student Home</title>')
    expect(body).toContain('Hello morris')
    expect(body).toContain('You are logged in as a student.')
    expect(body).toContain('Choose an option below.')
    expect(body).toContain('User Profile')
    expect(body).toContain('Schedule a Consultation')
    expect(body).toContain('/user_profile?user=morris&viewer=morris')
    expect(body).toContain('href="/schedule_consultation"')
  })

  test('Renders the lecturer home page after a successful login', async () => {
    getUser.mockResolvedValue({
      passwordHash: await hashPassword('welovesd3'),
      role: 'lecturer',
      username: 'lecturer1'
    })

    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        password: 'welovesd3',
        username: 'lecturer1'
      }),
      redirect: 'manual'
    })

    const sessionCookie = getSessionCookie(loginResponse.headers.get('set-cookie'))
    const response = await fetch(`${baseUrl}/home`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(loginResponse.status).toBe(302)
    expect(loginResponse.headers.get('location')).toBe('/home')
    expect(response.status).toBe(200)
    expect(body).toContain('<title>Lecturer Home</title>')
    expect(body).toContain('Hello lecturer1')
    expect(body).toContain('You are logged in as a lecturer.')
    expect(body).not.toContain('Schedule a Consultation')
  })

  test('Renders the schedule consultation page', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`)

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Schedule a Consultation</title>')
    expect(body).toContain('Schedule a Consultation')
  })
})

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
const MONTH_LABELS = Object.freeze([
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
])

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
 * Returns the current month label used on the home page calendar.
 * @param {Date} [referenceDate=new Date()] - Date used to choose the month label.
 * @returns {string} Current month label.
 */
const getCurrentMonthLabel = function (referenceDate = new Date()) {
  return `${MONTH_LABELS[referenceDate.getMonth()]} ${referenceDate.getFullYear()}`
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
    const currentMonthLabel = getCurrentMonthLabel()

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
    expect(body).toContain(currentMonthLabel)
    expect(body).toContain('calendar_table')
    expect(body).toContain('Sun')
    expect(body).toContain('Sat')
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
    const currentMonthLabel = getCurrentMonthLabel()

    expect(loginResponse.status).toBe(302)
    expect(loginResponse.headers.get('location')).toBe('/home')
    expect(response.status).toBe(200)
    expect(body).toContain('<title>Lecturer Home</title>')
    expect(body).toContain('Hello lecturer1')
    expect(body).toContain('You are logged in as a lecturer.')
    expect(body).toContain('Choose an option below.')
    expect(body).toContain('User Profile')
    expect(body).toContain('Scheduled Consultations')
    expect(body).toContain('/user_profile?user=lecturer1&viewer=lecturer1')
    expect(body).toContain('href="/scheduled_consultations"')
    expect(body).not.toContain('Schedule a Consultation')
    expect(body).toContain(currentMonthLabel)
    expect(body).toContain('calendar_table')
  })

  test('Renders the schedule consultation page', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`)

    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('<title>Schedule a Consultation</title>')
    expect(body).toContain('Schedule a Consultation')
    expect(body).toContain('This page is not available yet.')
    expect(body).toContain('Scheduling a consultation has not been built yet.')
    expect(body).toContain('href="/home"')
  })

  test('Renders the scheduled consultations page', async () => {
    const response = await fetch(`${baseUrl}/scheduled_consultations`)

    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('<title>Scheduled Consultations</title>')
    expect(body).toContain('Scheduled Consultations')
    expect(body).toContain('This page is not available yet.')
    expect(body).toContain('Scheduled consultations have not been built yet.')
    expect(body).toContain('href="/home"')
  })
})

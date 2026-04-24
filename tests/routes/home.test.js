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

let baseUrl

const MONTH_LABELS = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
])

const MOCK_LECTURERS = [
  { username: 'alice', firstName: 'Alice', lastName: 'Smith', facultyId: 'Engineering', schoolId: 'EIE' },
  { username: 'bob', firstName: 'Bob', lastName: 'Jones', facultyId: 'Science', schoolId: 'Physics' }
]

const MOCK_LECTURERS_21 = Array.from({ length: 21 }, function (_, i) {
  return { username: `lecturer${i}`, firstName: `First${i}`, lastName: `Last${i}`, facultyId: 'Engineering', schoolId: 'EIE' }
})

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
 * @param {string} [options.username='morris'] - Username used for login.
 * @returns {Promise<{loginResponse: Response, sessionCookie: string}>} Login response and session cookie.
 */
const loginAs = async function ({ role = 'student', username = 'morris' } = {}) {
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
    body: encodeForm({
      password: 'welovesd3',
      username
    }),
    redirect: 'manual'
  })

  return {
    loginResponse,
    sessionCookie: getSessionCookie(loginResponse.headers.get('set-cookie'))
  }
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
    connectToDatabase.mockResolvedValue(undefined)
    searchLecturers.mockResolvedValue([])
  })

  test('Redirects unauthenticated users to login when requesting the home page', async () => {
    const response = await fetch(`${baseUrl}/home`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(getUser).not.toHaveBeenCalled()
  })

  test('Renders the student home page after a successful login', async () => {
    const { loginResponse, sessionCookie } = await loginAs({
      role: 'student',
      username: 'morris'
    })
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
    expect(body).toContain('/user_profile?user=morris')
    expect(body).toContain('href="/schedule_consultation"')
    expect(body).toContain(currentMonthLabel)
    expect(body).toContain('calendar_table')
    expect(body).toContain('Sun')
    expect(body).toContain('Sat')
  })

  test('Renders the lecturer home page after a successful login', async () => {
    const { loginResponse, sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })
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
    expect(body).toContain('/user_profile?user=lecturer1')
    expect(body).toContain('href="/scheduled_consultations"')
    expect(body).not.toContain('Schedule a Consultation')
    expect(body).toContain(currentMonthLabel)
    expect(body).toContain('calendar_table')
  })

  test('Redirects unauthenticated users to login when requesting the schedule consultation page', async () => {
    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  test('Renders the schedule consultation page', async () => {
    const { sessionCookie } = await loginAs({
      role: 'student',
      username: 'morris'
    })
    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('<title>Schedule a Consultation</title>')
    expect(body).toContain('Schedule a Consultation')
    expect(body).toContain('This page is not available yet.')
    expect(body).toContain('Scheduling a consultation has not been built yet.')
    expect(body).toContain('href="/home"')
  })

  test('Redirects unauthenticated users to login when requesting the scheduled consultations page', async () => {
    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  test('Renders the scheduled consultations page', async () => {
    const { sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })
    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('<title>Scheduled Consultations</title>')
    expect(body).toContain('Scheduled Consultations')
    expect(body).toContain('This page is not available yet.')
    expect(body).toContain('Scheduled consultations have not been built yet.')
    expect(body).toContain('href="/home"')
  })

  test('Renders the home page without lecturer search for a non-student user', async () => {
    const { sessionCookie } = await loginAs({ role: 'lecturer', username: 'lectureruser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(searchLecturers).not.toHaveBeenCalled()
    expect(body).not.toContain('No lecturers found.')
  })

  test('Renders the home page with all lecturers for a student user', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alice Smith')
    expect(body).toContain('Bob Jones')
  })

  test('Passes the search query string to searchLecturers', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    await fetch(`${baseUrl}/home?q=alice`, {
      headers: { cookie: sessionCookie }
    })

    expect(searchLecturers).toHaveBeenCalledWith({ universityId: '', query: 'alice' })
  })

  test('Filters results by facultyId', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home?facultyId=Engineering`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alice Smith')
    expect(body).not.toContain('Bob Jones')
  })

  test('Filters results by schoolId', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home?schoolId=EIE`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alice Smith')
    expect(body).not.toContain('Bob Jones')
  })

  test('Shows the no results message when no lecturers match', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home?q=unknown`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No lecturers found.')
  })

  test('Renders the home page with empty results when the database throws', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    connectToDatabase.mockRejectedValue(new Error('DB error'))
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No lecturers found.')
  })

  test('Renders lecturer results as links to the user profile page', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('href="/user_profile?user=alice"')
    expect(body).toContain('href="/user_profile?user=bob"')
  })

  test('Returns JSON lecturer results when requested with Accept application/json', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(data.lecturers).toHaveLength(2)
    expect(data.page).toBe(1)
    expect(data.totalPages).toBe(1)
  })

  test('Returns empty JSON results when the database throws and JSON is requested', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    connectToDatabase.mockRejectedValue(new Error('DB error'))
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.lecturers).toHaveLength(0)
    expect(data.page).toBe(1)
    expect(data.totalPages).toBe(0)
  })

  test('Shows only the first 20 lecturers on page 1 when there are more than 20 results', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS_21)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(data.lecturers).toHaveLength(20)
    expect(data.page).toBe(1)
    expect(data.totalPages).toBe(2)
  })

  test('Shows the remaining lecturers on page 2', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS_21)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home?page=2`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(data.lecturers).toHaveLength(1)
    expect(data.page).toBe(2)
    expect(data.totalPages).toBe(2)
  })

  test('Renders pagination links when there are more than 20 results', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS_21)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('pagination')
    expect(body).toContain('page=1')
    expect(body).toContain('page=2')
  })
})

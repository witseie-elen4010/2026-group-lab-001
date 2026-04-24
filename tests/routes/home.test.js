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
const { searchLecturers } = require('../../src/models/user_db')
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

const STUDENT_SESSION = { username: 'testuser', universityId: 'wits', role: 'student', firstName: 'Test' }
const LECTURER_SESSION = { username: 'lectureruser', universityId: 'wits', role: 'lecturer', firstName: 'Prof' }

const MOCK_LECTURERS = [
  { username: 'alice', firstName: 'Alice', lastName: 'Smith', facultyId: 'Engineering', schoolId: 'EIE' },
  { username: 'bob', firstName: 'Bob', lastName: 'Jones', facultyId: 'Science', schoolId: 'Physics' }
]

describe('home route', () => {
  let server
  let baseUrl
  let studentCookie
  let lecturerCookie

  beforeAll(async () => {
    server = http.createServer(app)
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
    studentCookie = buildSessionCookie(STUDENT_SESSION)
    lecturerCookie = buildSessionCookie(LECTURER_SESSION)
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
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
  })

  test('Redirects to login when no session cookie is present', async () => {
    const response = await fetch(`${baseUrl}/home`, { redirect: 'manual' })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('Renders the home page without search for a non-student user', async () => {
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: lecturerCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(searchLecturers).not.toHaveBeenCalled()
    expect(body).not.toContain('No lecturers found.')
  })

  test('Renders the home page with all lecturers for a student user', async () => {
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: studentCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(searchLecturers).toHaveBeenCalledWith({ universityId: 'wits', query: '' })
    expect(body).toContain('Alice Smith')
    expect(body).toContain('Bob Jones')
  })

  test('Passes the search query string to searchLecturers', async () => {
    await fetch(`${baseUrl}/home?q=alice`, {
      headers: { cookie: studentCookie }
    })

    expect(searchLecturers).toHaveBeenCalledWith({ universityId: 'wits', query: 'alice' })
  })

  test('Filters results by facultyId', async () => {
    const response = await fetch(`${baseUrl}/home?facultyId=Engineering`, {
      headers: { cookie: studentCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alice Smith')
    expect(body).not.toContain('Bob Jones')
  })

  test('Filters results by schoolId', async () => {
    const response = await fetch(`${baseUrl}/home?schoolId=EIE`, {
      headers: { cookie: studentCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alice Smith')
    expect(body).not.toContain('Bob Jones')
  })

  test('Shows the no results message when no lecturers match', async () => {
    searchLecturers.mockResolvedValue([])

    const response = await fetch(`${baseUrl}/home?q=unknown`, {
      headers: { cookie: studentCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No lecturers found.')
  })

  test('Renders the home page with empty results when the database throws', async () => {
    connectToDatabase.mockRejectedValue(new Error('DB error'))

    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: studentCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No lecturers found.')
  })
})

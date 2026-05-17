jest.mock('../../../src/models/db', () => ({
  closeDatabaseConnection: jest.fn(),
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
  DATABASE_NAME: 'LetsTalk',
  getCollection: jest.fn(),
  getDb: jest.fn(),
  getMongoUri: jest.fn()
}))

jest.mock('../../../src/models/lecturer_availability_db', () => ({
  getLecturerAvailability: jest.fn()
}))

jest.mock('../../../src/models/user_db', () => ({
  addUser: jest.fn(),
  deleteUser: jest.fn(),
  getUser: jest.fn(),
  getUserByEmail: jest.fn(),
  getUserByGoogleId: jest.fn(),
  linkGoogleId: jest.fn(),
  searchLecturers: jest.fn()
}))

jest.mock('../../../src/models/consultation_db', () => ({
  getConsultationsForCalendar: jest.fn(),
  getUpcomingConsultationsForLecturer: jest.fn(),
  JOIN_RESULT_REASONS: {
    ALREADY_JOINED: 'already_joined',
    FULL: 'full',
    NOT_FOUND: 'not_found'
  },
  addConsultation: jest.fn(),
  cancelConsultation: jest.fn()
}))

jest.mock('../../../src/services/institution_validation', () => ({
  validateSelection: jest.fn()
}))

jest.mock('../../../src/config/passport', () => ({
  initialize: jest.fn(() => (req, res, next) => next()),
  authenticate: jest.fn((strategy, options, callback) => {
    if (typeof callback === 'function') {
      return (req, res, next) => callback(null, null)
    }
    return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
  })
}))

const http = require('node:http')
const passport = require('../../../src/config/passport')
const { connectToDatabase } = require('../../../src/models/db')
const { addUser, getUserByGoogleId, getUserByEmail } = require('../../../src/models/user_db')
const { validateSelection } = require('../../../src/services/institution_validation')
const app = require('../../../src/app')

const closeServer = async function (server) {
  if (!server) return
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) { reject(error); return }
      resolve()
    })
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections()
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
  })
}

const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

const getSessionCookie = function (setCookieHeader) {
  return setCookieHeader?.split(';')[0] || ''
}

const MOCK_PENDING_GOOGLE = {
  googleId: 'gid-123',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith'
}

const initGoogleSession = async function (baseUrl) {
  const mockProfile = {
    id: MOCK_PENDING_GOOGLE.googleId,
    emails: [{ value: MOCK_PENDING_GOOGLE.email }],
    name: {
      givenName: MOCK_PENDING_GOOGLE.firstName,
      familyName: MOCK_PENDING_GOOGLE.lastName
    }
  }

  passport.authenticate.mockImplementationOnce((strategy, options, callback) => {
    if (typeof callback === 'function') {
      return (req, res, next) => callback(null, mockProfile)
    }
    return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
  })
  getUserByGoogleId.mockResolvedValueOnce(null)
  getUserByEmail.mockResolvedValueOnce(null)

  const response = await fetch(`${baseUrl}/auth/google/callback`, {
    redirect: 'manual'
  })

  return getSessionCookie(response.headers.get('set-cookie'))
}

describe('register_complete route', () => {
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
    await closeServer(server)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    connectToDatabase.mockResolvedValue(undefined)
    getUserByGoogleId.mockResolvedValue(null)
    getUserByEmail.mockResolvedValue(null)
    addUser.mockResolvedValue({ acknowledged: true, insertedId: 'new-id' })
    validateSelection.mockResolvedValue({ isValid: true })
    passport.authenticate.mockImplementation((strategy, options, callback) => {
      if (typeof callback === 'function') {
        return (req, res, next) => callback(null, null)
      }
      return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
    })
  })

  test('GET /register/complete redirects to /register when there is no pending Google session', async () => {
    const response = await fetch(`${baseUrl}/register/complete`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/register')
  })

  test('GET /register/complete renders the form pre-filled with Google account data', async () => {
    const sessionCookie = await initGoogleSession(baseUrl)

    const response = await fetch(`${baseUrl}/register/complete`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Complete Your Profile')
    expect(body).toContain('alice@example.com')
    expect(body).toContain('Alice')
    expect(body).toContain('Smith')
  })

  test('POST /register/complete redirects to /register when there is no pending Google session', async () => {
    const response = await fetch(`${baseUrl}/register/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: encodeForm({ username: 'alice', role: 'student', university: 'Wits', faculty: 'Engineering', school: 'EIE' }),
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/register')
  })

  test('POST /register/complete returns 400 when required fields are missing', async () => {
    const sessionCookie = await initGoogleSession(baseUrl)

    const response = await fetch(`${baseUrl}/register/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({ username: 'alice', role: 'student', university: 'Wits', faculty: '', school: '' })
    })
    const body = await response.text()

    expect(response.status).toBe(400)
    expect(body).toContain('Username, role, and all institution fields are required.')
  })

  test('POST /register/complete returns an error when institution validation fails', async () => {
    validateSelection.mockResolvedValueOnce({
      isValid: false,
      statusCode: 400,
      error: 'Choose a university from the database list.'
    })
    const sessionCookie = await initGoogleSession(baseUrl)

    const response = await fetch(`${baseUrl}/register/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({ username: 'alice', role: 'student', university: 'Unknown', faculty: 'Engineering', school: 'EIE' })
    })
    const body = await response.text()

    expect(response.status).toBe(400)
    expect(body).toContain('Choose a university from the database list.')
  })

  test('POST /register/complete returns 409 when the username is already taken', async () => {
    const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 })
    addUser.mockRejectedValueOnce(duplicateKeyError)
    const sessionCookie = await initGoogleSession(baseUrl)

    const response = await fetch(`${baseUrl}/register/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({ username: 'alice', role: 'student', university: 'Wits', faculty: 'Engineering', school: 'EIE' })
    })
    const body = await response.text()

    expect(response.status).toBe(409)
    expect(body).toContain('That username is already taken.')
  })

  test('POST /register/complete creates the user and redirects to /home on success', async () => {
    const sessionCookie = await initGoogleSession(baseUrl)

    const response = await fetch(`${baseUrl}/register/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({ username: 'alice', role: 'student', university: 'Wits', faculty: 'Engineering', school: 'EIE' }),
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')
    expect(addUser).toHaveBeenCalledWith(expect.objectContaining({
      courses: [],
      degree: '',
      googleId: MOCK_PENDING_GOOGLE.googleId,
      email: MOCK_PENDING_GOOGLE.email,
      username: 'alice',
      role: 'student'
    }))
    expect(addUser).toHaveBeenCalledWith(expect.not.objectContaining({
      passwordHash: expect.anything()
    }))
  })

  test('POST /register creates a local user with empty academic defaults', async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'sam@example.com',
        username: 'sam',
        password: 'welovesd3',
        university: 'Wits',
        faculty: 'Engineering',
        school: 'EIE',
        role: 'student',
        name: 'Sam',
        surname: 'Ndlovu'
      }),
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(addUser).toHaveBeenCalledWith(expect.objectContaining({
      courses: [],
      degree: '',
      email: 'sam@example.com',
      firstName: 'Sam',
      lastName: 'Ndlovu',
      passwordHash: expect.any(String),
      role: 'student',
      username: 'sam'
    }))
  })

  test('POST /register/complete returns 500 when an unexpected error occurs', async () => {
    addUser.mockRejectedValueOnce(new Error('unexpected'))
    const sessionCookie = await initGoogleSession(baseUrl)

    const response = await fetch(`${baseUrl}/register/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({ username: 'alice', role: 'student', university: 'Wits', faculty: 'Engineering', school: 'EIE' })
    })
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Sorry. We could not create your account. Try again later.')
  })
})

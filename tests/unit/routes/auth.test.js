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
const { getUserByEmail, getUserByGoogleId, linkGoogleId } = require('../../../src/models/user_db')
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

describe('auth route', () => {
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
    linkGoogleId.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
    passport.authenticate.mockImplementation((strategy, options, callback) => {
      if (typeof callback === 'function') {
        return (req, res, next) => callback(null, null)
      }
      return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
    })
  })

  test('GET /auth/google redirects to Google OAuth', async () => {
    const response = await fetch(`${baseUrl}/auth/google`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/auth')
  })

  test('redirects to /login when Google sign-in results in an error', async () => {
    passport.authenticate.mockImplementationOnce((strategy, options, callback) => {
      if (typeof callback === 'function') {
        return (req, res, next) => callback(new Error('access_denied'), null)
      }
      return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
    })

    const response = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  test('redirects to /login when passport returns no profile', async () => {
    const response = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  test('sets session and redirects to /home for an existing user matched by googleId', async () => {
    const mockProfile = {
      id: 'gid-123',
      emails: [{ value: 'alice@example.com' }],
      name: { givenName: 'Alice', familyName: 'Smith' }
    }
    const mockUser = {
      username: 'alice',
      role: 'student',
      universityId: 'Wits',
      facultyId: 'Engineering',
      schoolId: 'EIE',
      firstName: 'Alice',
      lastName: 'Smith'
    }

    passport.authenticate.mockImplementationOnce((strategy, options, callback) => {
      if (typeof callback === 'function') {
        return (req, res, next) => callback(null, mockProfile)
      }
      return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
    })
    getUserByGoogleId.mockResolvedValueOnce(mockUser)

    const response = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')
    expect(getUserByGoogleId).toHaveBeenCalledWith('gid-123')
    expect(linkGoogleId).not.toHaveBeenCalled()
  })

  test('links googleId and redirects to /home for an existing user matched by email', async () => {
    const mockProfile = {
      id: 'gid-456',
      emails: [{ value: 'bob@example.com' }],
      name: { givenName: 'Bob', familyName: 'Jones' }
    }
    const mockUser = {
      username: 'bob',
      role: 'lecturer',
      universityId: 'Wits',
      facultyId: 'Science',
      schoolId: 'Physics',
      firstName: 'Bob',
      lastName: 'Jones'
    }

    passport.authenticate.mockImplementationOnce((strategy, options, callback) => {
      if (typeof callback === 'function') {
        return (req, res, next) => callback(null, mockProfile)
      }
      return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
    })
    getUserByGoogleId.mockResolvedValueOnce(null)
    getUserByEmail.mockResolvedValueOnce(mockUser)

    const response = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')
    expect(getUserByEmail).toHaveBeenCalledWith('bob@example.com')
    expect(linkGoogleId).toHaveBeenCalledWith('bob', 'gid-456')
  })

  test('sets pendingGoogle and redirects to /register/complete for a new Google user', async () => {
    const mockProfile = {
      id: 'gid-789',
      emails: [{ value: 'new@example.com' }],
      name: { givenName: 'New', familyName: 'User' }
    }

    passport.authenticate.mockImplementationOnce((strategy, options, callback) => {
      if (typeof callback === 'function') {
        return (req, res, next) => callback(null, mockProfile)
      }
      return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
    })

    const response = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/register/complete')
    expect(getUserByGoogleId).toHaveBeenCalledWith('gid-789')
    expect(getUserByEmail).toHaveBeenCalledWith('new@example.com')
    expect(linkGoogleId).not.toHaveBeenCalled()
  })
})

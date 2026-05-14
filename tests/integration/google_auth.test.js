jest.mock('../../src/config/passport', () => ({
  initialize: jest.fn(() => (req, res, next) => next()),
  authenticate: jest.fn((strategy, options, callback) => {
    if (typeof callback === 'function') {
      return (req, res, next) => callback(null, null)
    }
    return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
  })
}))

const http = require('node:http')
const passport = require('../../src/config/passport')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const app = require('../../src/app')

const TEST_ID = `${process.pid}${Date.now()}`
const TEST_EMAIL_BY_GOOGLE_ID = `itest-gid-${TEST_ID}@example.com`
const TEST_EMAIL_BY_EMAIL = `itest-email-${TEST_ID}@example.com`
const TEST_EMAIL_NEW = `itest-new-${TEST_ID}@example.com`
const TEST_USERNAME_BY_GOOGLE_ID = `itestgid${TEST_ID}`
const TEST_USERNAME_BY_EMAIL = `itestemailuser${TEST_ID}`
const TEST_USERNAME_NEW = `itestnew${TEST_ID}`
const TEST_GOOGLE_ID_EXISTING = `gid-existing-${TEST_ID}`
const TEST_GOOGLE_ID_NEW = `gid-new-${TEST_ID}`
const TEST_GOOGLE_ID_EMAIL_MATCH = `gid-emailmatch-${TEST_ID}`

const RUN_DB_TEST = process.env.MONGODB_URI ? test : test.skip

const closeServer = async function (server) {
  if (!server) return
  await new Promise(function (resolve, reject) {
    server.close(function (error) {
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

const mockAuthCallback = function (profile) {
  passport.authenticate.mockImplementationOnce((strategy, options, callback) => {
    if (typeof callback === 'function') {
      return (req, res, next) => callback(null, profile)
    }
    return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
  })
}

describe('Google auth integration flow', () => {
  let baseUrl
  let server

  beforeAll(async function () {
    if (!process.env.MONGODB_URI) return

    await connectToDatabase()
    const users = await getCollection('User')

    await users.insertOne({
      username: TEST_USERNAME_BY_GOOGLE_ID,
      email: TEST_EMAIL_BY_GOOGLE_ID,
      googleId: TEST_GOOGLE_ID_EXISTING,
      firstName: 'ExistingGid',
      lastName: 'User',
      role: 'student',
      universityId: 'Wits',
      facultyId: 'Engineering',
      schoolId: 'EIE'
    })

    await users.insertOne({
      username: TEST_USERNAME_BY_EMAIL,
      email: TEST_EMAIL_BY_EMAIL,
      firstName: 'ExistingEmail',
      lastName: 'User',
      role: 'lecturer',
      universityId: 'Wits',
      facultyId: 'Engineering',
      schoolId: 'EIE'
    })

    server = http.createServer(app)
    await new Promise(function (resolve) {
      server.listen(0, '127.0.0.1', function () {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) return

    const users = await getCollection('User')
    await users.deleteMany({
      username: {
        $in: [TEST_USERNAME_BY_GOOGLE_ID, TEST_USERNAME_BY_EMAIL, TEST_USERNAME_NEW]
      }
    })

    await closeServer(server)
    await closeDatabaseConnection()
  })

  beforeEach(() => {
    passport.authenticate.mockImplementation((strategy, options, callback) => {
      if (typeof callback === 'function') {
        return (req, res, next) => callback(null, null)
      }
      return (req, res, next) => res.redirect('https://accounts.google.com/o/oauth2/auth')
    })
  })

  RUN_DB_TEST('redirects to /home for an existing user matched by googleId', async function () {
    mockAuthCallback({
      id: TEST_GOOGLE_ID_EXISTING,
      emails: [{ value: TEST_EMAIL_BY_GOOGLE_ID }],
      name: { givenName: 'ExistingGid', familyName: 'User' }
    })

    const response = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')
  })

  RUN_DB_TEST('links googleId in the database for an existing user matched by email', async function () {
    mockAuthCallback({
      id: TEST_GOOGLE_ID_EMAIL_MATCH,
      emails: [{ value: TEST_EMAIL_BY_EMAIL }],
      name: { givenName: 'ExistingEmail', familyName: 'User' }
    })

    const response = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')

    const users = await getCollection('User')
    const updatedUser = await users.findOne({ username: TEST_USERNAME_BY_EMAIL })
    expect(updatedUser.googleId).toBe(TEST_GOOGLE_ID_EMAIL_MATCH)
  })

  RUN_DB_TEST('registers a new Google user and stores them in the database', async function () {
    mockAuthCallback({
      id: TEST_GOOGLE_ID_NEW,
      emails: [{ value: TEST_EMAIL_NEW }],
      name: { givenName: 'New', familyName: 'GoogleUser' }
    })

    const callbackResponse = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual'
    })

    expect(callbackResponse.status).toBe(302)
    expect(callbackResponse.headers.get('location')).toBe('/register/complete')

    const sessionCookie = getSessionCookie(callbackResponse.headers.get('set-cookie'))

    const completeResponse = await fetch(`${baseUrl}/register/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({
        username: TEST_USERNAME_NEW,
        role: 'student',
        university: 'University of the Witwatersrand',
        faculty: 'Engineering and the Built Environment',
        school: 'Electrical and Information Engineering'
      }),
      redirect: 'manual'
    })

    expect(completeResponse.status).toBe(302)
    expect(completeResponse.headers.get('location')).toBe('/home')

    const users = await getCollection('User')
    const newUser = await users.findOne({ username: TEST_USERNAME_NEW })
    expect(newUser).not.toBeNull()
    expect(newUser.googleId).toBe(TEST_GOOGLE_ID_NEW)
    expect(newUser.email).toBe(TEST_EMAIL_NEW)
    expect(newUser.role).toBe('student')
    expect(newUser.passwordHash).toBeUndefined()
  })
})

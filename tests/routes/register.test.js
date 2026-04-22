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

const { connectToDatabase } = require('../../src/models/db')
const { addUser } = require('../../src/models/user_db')
const app = require('../../src/app')

/**
 * Encodes form fields for URL-encoded POST requests.
 * @param {Record<string, string>} fields - Form fields to encode.
 * @returns {string} URL-encoded form payload.
 */
const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

describe('register route', () => {
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
    connectToDatabase.mockResolvedValue(undefined)
    addUser.mockResolvedValue({ acknowledged: true, insertedId: 'new-user-id' })
  })

  test('Creates a user from the Register form and redirects to login page', async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        password: 'welovesd3',
        username: 'morris'
      }),
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(addUser).toHaveBeenCalledTimes(1)
    expect(addUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'newuser@example.com',
      facultyId: 'unassigned',
      firstName: 'Pending',
      lastName: 'Pending',
      role: 'student',
      schoolId: 'unassigned',
      universityId: 'unassigned',
      username: 'morris'
    }))

    const insertedUser = addUser.mock.calls[0][0]
    expect(insertedUser.passwordHash).toContain(':')
    expect(insertedUser.passwordHash).not.toBe('welovesd3')
  })

  test('Re-renders the Register page when required fields are missing', async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: '',
        password: '',
        username: ''
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Username, Email and Password are required.')
  })

  test('Re-renders the Register page when the email address format is invalid', async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'not-an-email',
        password: 'welovesd3',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Enter a valid email address.')
  })

  test('Re-renders the Register page when the username already exists', async () => {
    addUser.mockRejectedValue({ code: 11000 })

    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        password: 'welovesd3',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(409)
    expect(body).toContain('That username is already taken.')
  })
})

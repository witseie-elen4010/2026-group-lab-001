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

describe('login route', () => {
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

  beforeEach(async () => {
    jest.clearAllMocks()
    connectToDatabase.mockResolvedValue(undefined)
    getUser.mockResolvedValue({
      passwordHash: await hashPassword('welovesd3'),
      role: 'student',
      username: 'morris'
    })
  })

  test('Redirects to home page when the username and password match', async () => {
    const response = await fetch(`${baseUrl}/login`, {
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

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledWith('morris')
  })

  test('Renders the Login page for GET requests', async () => {
    const response = await fetch(`${baseUrl}/login`)

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(body).toContain('<title>Log In</title>')
  })

  test('Re-renders the Login page when required fields are missing', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        password: '',
        username: ''
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
    expect(body).toContain('Username and Password are required.')
  })

  test('Re-renders the Login page when the user does not exist', async () => {
    getUser.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        password: 'welovesd3',
        username: 'anonymous'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(404)
    expect(body).toContain('User does not exist.')
  })

  test('Re-renders the Login page when the password is incorrect', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        password: 'wrong-password',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(401)
    expect(body).toContain('Password is incorrect.')
  })

  test('Re-renders the Login page when the database request fails', async () => {
    connectToDatabase.mockRejectedValue(new Error('database unavailable'))

    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        password: 'welovesd3',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Sorry. We could not log you in. Try again later.')
  })
})

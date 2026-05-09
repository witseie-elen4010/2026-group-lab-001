jest.mock('../../../src/models/db', () => ({
  closeDatabaseConnection: jest.fn(),
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
  DATABASE_NAME: 'LetsTalk',
  getCollection: jest.fn(),
  getDb: jest.fn(),
  getMongoUri: jest.fn()
}))

jest.mock('../../../src/models/logs_db', () => ({
  addLog: jest.fn().mockResolvedValue(undefined),
  getLogsPage: jest.fn()
}))

jest.mock('../../../src/models/user_db', () => ({
  addUser: jest.fn(),
  deleteUser: jest.fn(),
  getUser: jest.fn()
}))

const http = require('node:http')
const { connectToDatabase } = require('../../../src/models/db')
const { getLogsPage } = require('../../../src/models/logs_db')
const { getUser } = require('../../../src/models/user_db')
const { hashPassword } = require('../../../src/utils/password')
const app = require('../../../src/app')

let baseUrl

const MOCK_LOGS = [
  { date: '2026-05-09', time: '13:00:00', username: 'user1', label: 'Logged in', httpCode: 302 },
  { date: '2026-05-09', time: '12:55:00', username: 'user2', label: 'Viewed Home page', httpCode: 200 }
]

const closeServer = async function (server) {
  if (!server) {
    return
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })

    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections()
    }

    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
  })
}

const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

const loginAs = async function ({ role = 'admin', username = 'user' } = {}) {
  getUser.mockResolvedValueOnce({
    passwordHash: await hashPassword('testpass'),
    role,
    username
  })

  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: encodeForm({
      password: 'testpass',
      username
    }),
    redirect: 'manual'
  })

  return {
    loginResponse,
    sessionCookie: loginResponse.headers.get('set-cookie')?.split(';')[0] || ''
  }
}

describe('logs route', () => {
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
    await closeServer(server)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    connectToDatabase.mockResolvedValue(undefined)
    getLogsPage.mockResolvedValue({ logs: [], hasNextPage: false })
  })

  test('Redirects unauthenticated users to login when requesting the logs page', async () => {
    const response = await fetch(`${baseUrl}/logs`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  test('Denies non-admin users access to the logs page', async () => {
    const { sessionCookie } = await loginAs({
      role: 'student',
      username: 'student_user'
    })

    const response = await fetch(`${baseUrl}/logs`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(403)
    expect(body).toContain('Only the admin can view logs.')
  })

  test('Renders the logs page with logs for an admin user', async () => {
    getLogsPage.mockResolvedValueOnce({ logs: MOCK_LOGS, hasNextPage: false })

    const { sessionCookie } = await loginAs({
      role: 'admin',
      username: 'user'
    })

    const response = await fetch(`${baseUrl}/logs`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>View Logs</title>')
    expect(body).toContain('Hello user')
    expect(body).toContain('[2026-05-09 13:00:00] user1 | Logged in | HTTP 302')
    expect(body).toContain('[2026-05-09 12:55:00] user2 | Viewed Home page | HTTP 200')
    expect(connectToDatabase).toHaveBeenCalled()
    expect(getLogsPage).toHaveBeenCalledWith(1, 50)
  })

  test('Renders the logs page with empty message when no logs exist', async () => {
    getLogsPage.mockResolvedValueOnce({ logs: [], hasNextPage: false })

    const { sessionCookie } = await loginAs({
      role: 'admin',
      username: 'user'
    })

    const response = await fetch(`${baseUrl}/logs`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No logs available.')
  })

  test('Renders pagination links when additional pages are available', async () => {
    getLogsPage.mockResolvedValueOnce({ logs: MOCK_LOGS, hasNextPage: true })

    const { sessionCookie } = await loginAs({
      role: 'admin',
      username: 'user'
    })

    const response = await fetch(`${baseUrl}/logs?page=2`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('href="/logs?page=1"')
    expect(body).toContain('href="/logs?page=3"')
    expect(body).toContain('Page 2')
    expect(getLogsPage).toHaveBeenCalledWith(2, 50)
  })

  test('Defaults to page 1 for invalid page query values', async () => {
    getLogsPage.mockResolvedValueOnce({ logs: MOCK_LOGS, hasNextPage: false })

    const { sessionCookie } = await loginAs({
      role: 'admin',
      username: 'user'
    })

    const response = await fetch(`${baseUrl}/logs?page=banana`, {
      headers: {
        cookie: sessionCookie
      }
    })

    expect(response.status).toBe(200)
    expect(getLogsPage).toHaveBeenCalledWith(1, 50)
  })

  test('Returns a server error when loading logs fails', async () => {
    getLogsPage.mockRejectedValueOnce(new Error('database unavailable'))

    const { sessionCookie } = await loginAs({
      role: 'admin',
      username: 'user'
    })

    const response = await fetch(`${baseUrl}/logs`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Unable to load logs right now.')
  })
})

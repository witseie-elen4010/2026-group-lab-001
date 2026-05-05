const http = require('node:http')
const { closeDatabaseConnection } = require('../../src/models/db')
const app = require('../../src/app')

const PASSWORD = 'password'
const USERNAME = 'user'
const RUN_DB_TEST = process.env.MONGODB_URI ? test : test.skip

const closeServer = async function (server) {
  if (!server) {
    return
  }

  await new Promise(function (resolve, reject) {
    server.close(function (error) {
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

describe('student login integration flow', () => {
  let baseUrl
  let server

  beforeAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    server = http.createServer(app)

    await new Promise(function (resolve) {
      server.listen(0, '127.0.0.1', function () {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('logs in with the seeded student user and renders student-specific home navigation', async function () {
    const loginResponse = await fetch(`${baseUrl}/login`, {
      body: encodeForm({
        password: PASSWORD,
        username: USERNAME
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      redirect: 'manual'
    })

    const sessionCookie = loginResponse.headers.get('set-cookie')?.split(';')[0] || ''

    expect(loginResponse.status).toBe(302)
    expect(loginResponse.headers.get('location')).toBe('/home')
    expect(sessionCookie).toContain('connect.sid=')

    const homeResponse = await fetch(`${baseUrl}/home`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const body = await homeResponse.text()

    expect(homeResponse.status).toBe(200)
    expect(body).toContain('<title>Student Home</title>')
    expect(body).toContain(`Hello ${USERNAME}`)
    expect(body).toContain('You are logged in as a student.')
    expect(body).toContain('Create Consultation')
    expect(body).toContain('Join Consultation')
    expect(body).toContain('href="/consultations/new"')
    expect(body).toContain('href="/join_consultation"')
    expect(body).toContain('Find a Lecturer')
    expect(body).not.toContain('Scheduled Consultations')
  })

  RUN_DB_TEST('renders the student schedule consultation placeholder page', async function () {
    const loginResponse = await fetch(`${baseUrl}/login`, {
      body: encodeForm({
        password: PASSWORD,
        username: USERNAME
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      redirect: 'manual'
    })

    const sessionCookie = loginResponse.headers.get('set-cookie')?.split(';')[0] || ''
    const response = await fetch(`${baseUrl}/schedule_consultation`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('<title>Schedule a Consultation</title>')
    expect(body).toContain('Scheduling a consultation has not been built yet.')
    expect(body).toContain('href="/home"')
  })

  RUN_DB_TEST('blocks the seeded student user from the lecturer dashboard page', async function () {
    const loginResponse = await fetch(`${baseUrl}/login`, {
      body: encodeForm({
        password: PASSWORD,
        username: USERNAME
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      redirect: 'manual'
    })

    const sessionCookie = loginResponse.headers.get('set-cookie')?.split(';')[0] || ''
    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const body = await response.text()

    expect(response.status).toBe(403)
    expect(body).toContain('<title>Lecturer Dashboard</title>')
    expect(body).toContain('Only lecturers can access the lecturer dashboard.')
    expect(body).not.toContain('No upcoming consultations yet.')
  })
})

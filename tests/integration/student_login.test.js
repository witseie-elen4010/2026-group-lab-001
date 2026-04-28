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
    expect(body).toContain('Schedule a Consultation')
    expect(body).toContain('href="/schedule_consultation"')
    expect(body).toContain('Find a Lecturer')
    expect(body).not.toContain('Scheduled Consultations')
  })
})

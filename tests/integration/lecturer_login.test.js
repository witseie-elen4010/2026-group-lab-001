const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const app = require('../../src/app')

const PASSWORD = 'password1'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_TITLE_PREFIX = 'lecturer-dashboard-integration-'
const USERNAME = 'user1'
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

const deleteTestConsultations = async function () {
  await connectToDatabase()
  await getCollection('Consultation').deleteMany({ title: { $regex: `^${TEST_TITLE_PREFIX}` } })
}

const getRelativeDatetime = function (offsetHours) {
  return new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString().slice(0, 16)
}

describe('lecturer login integration flow', () => {
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

  beforeEach(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await deleteTestConsultations()
  })

  afterEach(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await deleteTestConsultations()
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await deleteTestConsultations()
    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('logs in with the seeded lecturer user and renders lecturer-specific home navigation', async function () {
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
    expect(body).toContain('<title>Lecturer Home</title>')
    expect(body).toContain('You are logged in as a lecturer.')
    expect(body).toContain('User Profile')
    expect(body).toContain(`href="/user_profile?user=${USERNAME}"`)
    expect(body).toContain('Scheduled Consultations')
    expect(body).toContain('href="/scheduled_consultations"')
    expect(body).not.toContain('Join Consultation')
    expect(body).not.toContain('Find a Lecturer')
  })

  RUN_DB_TEST('renders the lecturer dashboard page and blocks the create consultation form', async function () {
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
    const scheduledResponse = await fetch(`${baseUrl}/scheduled_consultations`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const scheduledBody = await scheduledResponse.text()
    const createResponse = await fetch(`${baseUrl}/consultations/new`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const createBody = await createResponse.text()

    expect(scheduledResponse.status).toBe(200)
    expect(scheduledBody).toContain('<title>Lecturer Dashboard</title>')
    expect(scheduledBody).toContain('View your upcoming consultations and calendar in one place.')
    expect(scheduledBody).toContain('Upcoming Consultations')
    expect(scheduledBody).toContain('Calendar')
    expect(scheduledBody).toContain('calendar_table')
    expect(createResponse.status).toBe(403)
    expect(createBody).toContain('Only students can create consultations.')
  })

  RUN_DB_TEST('shows upcoming consultations for the logged in lecturer on the dashboard', async function () {
    const visibleTitle = `${TEST_TITLE_PREFIX}visible-${TEST_ID}`
    const otherLecturerTitle = `${TEST_TITLE_PREFIX}other-${TEST_ID}`
    const pastTitle = `${TEST_TITLE_PREFIX}past-${TEST_ID}`
    const visibleDatetime = getRelativeDatetime(24)

    await connectToDatabase()
    const users = getCollection('User')
    const seededStudent = await users.findOne({ username: 'user' })

    if (!seededStudent) {
      throw new Error('Seeded student user for lecturer dashboard integration tests was not found.')
    }

    const rosterAttendeeName = `${seededStudent.firstName || ''} ${seededStudent.lastName || ''}`.trim() || seededStudent.username

    await getCollection('Consultation').insertMany([
      {
        attendees: [seededStudent.username],
        capacity: 1,
        datetime: visibleDatetime,
        lecturerId: USERNAME,
        organiserId: 'dashboard-student',
        title: visibleTitle
      },
      {
        attendees: ['student2'],
        capacity: 1,
        datetime: getRelativeDatetime(48),
        lecturerId: 'other-lecturer',
        organiserId: 'dashboard-student',
        title: otherLecturerTitle
      },
      {
        attendees: ['student3'],
        capacity: 1,
        datetime: getRelativeDatetime(-24),
        lecturerId: USERNAME,
        organiserId: 'dashboard-student',
        title: pastTitle
      }
    ])

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

    expect(response.status).toBe(200)
    expect(body).toContain(visibleTitle)
    expect(body).toContain('dashboard-student')
    expect(body).toContain(visibleDatetime.slice(0, 10))
    expect(body).toContain(visibleDatetime.slice(11, 16))
    expect(body).toContain('Attendee roster')
    expect(body).toContain(rosterAttendeeName)
    expect(body).toContain('calendar_table')
    expect(body).toContain('calendar_day_note_dashboard')
    expect(body).not.toContain(otherLecturerTitle)
    expect(body).not.toContain(pastTitle)
  })
})

'use strict'

const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const app = require('../../src/app')

const LECTURER_USERNAME = 'user1'
const LECTURER_PASSWORD = 'password1'
const STUDENT_USERNAME = 'user'
const STUDENT_PASSWORD = 'password'
const RUN_DB_TEST = process.env.MONGODB_URI ? test : test.skip
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_TITLE_PREFIX = 'daily-summary-integration-'

let baseUrl
let server

const closeServer = async function (server) {
  if (!server) return

  await new Promise(function (resolve, reject) {
    server.close(function (error) {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })

    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections()
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
  })
}

const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

const loginAs = async function (baseUrl, { password, username }) {
  const response = await fetch(`${baseUrl}/login`, {
    body: encodeForm({ password, username }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    redirect: 'manual'
  })

  return response.headers.get('set-cookie')?.split(';')[0] || ''
}

const deleteTestConsultations = async function () {
  await connectToDatabase()
  await getCollection('Consultation').deleteMany({ title: { $regex: `^${TEST_TITLE_PREFIX}` } })
}

const getTodayDatetime = function (hours, minutes = 0) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  return `${year}-${month}-${day}T${hh}:${mm}`
}

describe('daily summary integration', () => {
  beforeAll(async function () {
    if (!process.env.MONGODB_URI) return

    server = http.createServer(app)

    await new Promise(function (resolve) {
      server.listen(0, '127.0.0.1', function () {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  beforeEach(async function () {
    if (!process.env.MONGODB_URI) return
    await deleteTestConsultations()
  })

  afterEach(async function () {
    if (!process.env.MONGODB_URI) return
    await deleteTestConsultations()
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) return
    await deleteTestConsultations()
    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('redirects unauthenticated users to login', async function () {
    const response = await fetch(`${baseUrl}/daily_summary`, { redirect: 'manual' })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  RUN_DB_TEST('returns 403 when a student accesses the daily summary', async function () {
    const sessionCookie = await loginAs(baseUrl, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })

    const response = await fetch(`${baseUrl}/daily_summary`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(403)
    expect(body).toContain('Only lecturers can access the daily summary.')
  })

  RUN_DB_TEST('renders an empty daily summary when the lecturer has no consultations today', async function () {
    const sessionCookie = await loginAs(baseUrl, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    const response = await fetch(`${baseUrl}/daily_summary`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Daily Summary')
    expect(body).toContain('No consultations scheduled for today.')
  })

  RUN_DB_TEST('shows today\'s consultations grouped by time slot', async function () {
    const earlyDatetime = getTodayDatetime(9, 0)
    const lateDatetime = getTodayDatetime(14, 0)
    const earlyTitle = `${TEST_TITLE_PREFIX}early-${TEST_ID}`
    const lateTitle = `${TEST_TITLE_PREFIX}late-${TEST_ID}`
    const earlyTitle2 = `${TEST_TITLE_PREFIX}early2-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertMany([
      {
        attendees: [],
        capacity: 5,
        datetime: earlyDatetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser1',
        title: earlyTitle
      },
      {
        attendees: [],
        capacity: 5,
        datetime: earlyDatetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser2',
        title: earlyTitle2
      },
      {
        attendees: [],
        capacity: 5,
        datetime: lateDatetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser3',
        title: lateTitle
      }
    ])

    const sessionCookie = await loginAs(baseUrl, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    const response = await fetch(`${baseUrl}/daily_summary`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain(earlyTitle)
    expect(body).toContain(earlyTitle2)
    expect(body).toContain(lateTitle)
    expect(body).toContain('09:00')
    expect(body).toContain('14:00')
    expect(body).toContain('daily_summary_slot')
  })

  RUN_DB_TEST('does not show consultations for other lecturers', async function () {
    const datetime = getTodayDatetime(10, 0)
    const ownTitle = `${TEST_TITLE_PREFIX}own-${TEST_ID}`
    const otherTitle = `${TEST_TITLE_PREFIX}other-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertMany([
      {
        attendees: [],
        capacity: 5,
        datetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser1',
        title: ownTitle
      },
      {
        attendees: [],
        capacity: 5,
        datetime,
        lecturerId: 'other-lecturer',
        organiserId: 'organiser2',
        title: otherTitle
      }
    ])

    const sessionCookie = await loginAs(baseUrl, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    const response = await fetch(`${baseUrl}/daily_summary`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain(ownTitle)
    expect(body).not.toContain(otherTitle)
  })
})

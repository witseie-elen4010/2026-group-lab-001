const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const { hashPassword } = require('../../src/utils/password')
const app = require('../../src/app')

const LECTURER_USERNAME = 'user1'
const PASSWORD = 'password'
const PEER_SEARCH_TEST_USERNAME = `peer-search-${process.pid}`
const RUN_DB_TEST = process.env.MONGODB_URI ? test : test.skip
const STUDENT_USERNAME = 'user'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_TITLE_PREFIX = 'home-calendar-integration-'

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

const deletePeerSearchUsers = async function () {
  await connectToDatabase()
  await getCollection('User').deleteMany({ username: { $regex: `^${PEER_SEARCH_TEST_USERNAME}` } })
}

const getFutureCurrentMonthDatetime = function () {
  const future = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const year = future.getFullYear()
  const month = String(future.getMonth() + 1).padStart(2, '0')
  const day = String(future.getDate()).padStart(2, '0')
  const hours = String(future.getHours()).padStart(2, '0')
  const minutes = String(future.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

describe('home calendar integration', () => {
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
    await deletePeerSearchUsers()
  })

  afterEach(async function () {
    if (!process.env.MONGODB_URI) return
    await deleteTestConsultations()
    await deletePeerSearchUsers()
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) return
    await deleteTestConsultations()
    await deletePeerSearchUsers()
    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('shows a joined consultation on the student home calendar', async function () {
    const datetime = getFutureCurrentMonthDatetime()
    const title = `${TEST_TITLE_PREFIX}joined-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertOne({
      attendees: [STUDENT_USERNAME],
      capacity: 5,
      datetime,
      lecturerId: LECTURER_USERNAME,
      organiserId: STUDENT_USERNAME,
      title
    })

    const sessionCookie = await loginAs(baseUrl, { password: PASSWORD, username: STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/home`, { headers: { cookie: sessionCookie } })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain(title)
    expect(body).toContain('Joined')
    expect(body).toContain('calendar_day_note_joined')
  })

  RUN_DB_TEST('shows an unjoined consultation on the student home calendar', async function () {
    const datetime = getFutureCurrentMonthDatetime()
    const title = `${TEST_TITLE_PREFIX}unjoined-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertOne({
      attendees: [],
      capacity: 5,
      datetime,
      lecturerId: LECTURER_USERNAME,
      organiserId: 'organiser1',
      title
    })

    const sessionCookie = await loginAs(baseUrl, { password: PASSWORD, username: STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/home`, { headers: { cookie: sessionCookie } })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain(title)
    expect(body).toContain('Unjoined')
    expect(body).toContain('calendar_day_note_unjoined')
  })

  RUN_DB_TEST('shows a fully booked consultation on the student home calendar', async function () {
    const datetime = getFutureCurrentMonthDatetime()
    const title = `${TEST_TITLE_PREFIX}full-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertOne({
      attendees: ['student2'],
      capacity: 1,
      datetime,
      lecturerId: LECTURER_USERNAME,
      organiserId: 'student2',
      title
    })

    const sessionCookie = await loginAs(baseUrl, { password: PASSWORD, username: STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/home`, { headers: { cookie: sessionCookie } })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain(title)
    expect(body).toContain('Fully Booked')
    expect(body).toContain('calendar_day_note_full')
  })

  RUN_DB_TEST('does not show past consultations on the student home calendar', async function () {
    const pastDatetime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().slice(0, 16)
    const title = `${TEST_TITLE_PREFIX}past-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertOne({
      attendees: [],
      capacity: 5,
      datetime: pastDatetime,
      lecturerId: LECTURER_USERNAME,
      organiserId: 'organiser1',
      title
    })

    const sessionCookie = await loginAs(baseUrl, { password: PASSWORD, username: STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/home`, { headers: { cookie: sessionCookie } })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).not.toContain(title)
  })

  RUN_DB_TEST('finds a peer on the home page by course and degree', async function () {
    await connectToDatabase()
    const users = getCollection('User')
    const seededStudent = await users.findOne({ username: STUDENT_USERNAME })

    await users.insertOne({
      username: `${PEER_SEARCH_TEST_USERNAME}-${TEST_ID}`,
      passwordHash: await hashPassword('password'),
      role: 'student',
      email: `peer-search-${TEST_ID}@example.com`,
      firstName: 'Amogelang',
      lastName: 'Maseko',
      universityId: seededStudent?.universityId || 'University of the Witwatersrand',
      facultyId: 'Engineering',
      schoolId: 'Electrical Engineering',
      degree: 'BSc (Eng) - Electrical Engineering',
      courses: ['ELEN Circuit Theory', 'ELEN Electronics']
    })

    const sessionCookie = await loginAs(baseUrl, { password: PASSWORD, username: STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/home?peerDegree=Electrical%20Engineering&peerCourse=ELEN`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Find a Wits Peer')
    expect(body).toContain('Amogelang Maseko')
    expect(body).toContain('ELEN Circuit Theory, ELEN Electronics')
    expect(body).toContain('BSc (Eng) - Electrical Engineering')
  })
})

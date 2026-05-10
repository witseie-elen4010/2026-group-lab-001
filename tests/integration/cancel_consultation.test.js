const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const app = require('../../src/app')

const STUDENT_PASSWORD = 'password'
const LECTURER_PASSWORD = 'password1'
const SEEDED_STUDENT_USERNAME = 'user'
const SEEDED_LECTURER_USERNAME = 'user1'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_STUDENT_USERNAME = `iteststud${TEST_ID}cancel`
const TEST_LECTURER_USERNAME = `itestlect${TEST_ID}cancel`
const TEST_UNIVERSITY_ID = `integration-cancel-university-${TEST_ID}`
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

const loginAs = async function (baseUrl, { password, username }) {
  const response = await fetch(`${baseUrl}/login`, {
    body: encodeForm({ password, username }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    redirect: 'manual'
  })

  return response.headers.get('set-cookie')?.split(';')[0] || ''
}

const futureDatetime = function () {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  date.setHours(9, 0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:00`
}

describe('cancel consultation integration flow', () => {
  let baseUrl
  let server

  beforeAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    const users = await getCollection('User')
    const seededStudent = await users.findOne({ username: SEEDED_STUDENT_USERNAME })
    const seededLecturer = await users.findOne({ username: SEEDED_LECTURER_USERNAME })

    if (!seededStudent || !seededLecturer) {
      throw new Error('Seeded users for cancel consultation integration tests were not found.')
    }

    const { _id: _sid, username: _su, email: _se, ...studentFields } = seededStudent
    const { _id: _lid, username: _lu, email: _le, ...lecturerFields } = seededLecturer

    await users.deleteMany({ username: { $in: [TEST_STUDENT_USERNAME, TEST_LECTURER_USERNAME] } })
    await users.insertMany([
      { ...studentFields, email: `${TEST_STUDENT_USERNAME}@example.test`, universityId: TEST_UNIVERSITY_ID, username: TEST_STUDENT_USERNAME },
      { ...lecturerFields, email: `${TEST_LECTURER_USERNAME}@example.test`, universityId: TEST_UNIVERSITY_ID, username: TEST_LECTURER_USERNAME }
    ])

    server = http.createServer(app)

    await new Promise(function (resolve) {
      server.listen(0, '127.0.0.1', function () {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  afterEach(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    await getCollection('Consultation').deleteMany({ organiserId: TEST_STUDENT_USERNAME })
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    await getCollection('Consultation').deleteMany({ organiserId: TEST_STUDENT_USERNAME })
    await getCollection('User').deleteMany({ username: { $in: [TEST_STUDENT_USERNAME, TEST_LECTURER_USERNAME] } })

    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('returns the students upcoming consultations', async function () {
    await connectToDatabase()
    const { insertedId } = await getCollection('Consultation').insertOne({
      attendees: [TEST_STUDENT_USERNAME],
      capacity: 1,
      datetime: futureDatetime(),
      lecturerId: TEST_LECTURER_USERNAME,
      organiserId: TEST_STUDENT_USERNAME,
      title: 'Integration cancel test consultation'
    })

    const sessionCookie = await loginAs(baseUrl, { password: STUDENT_PASSWORD, username: TEST_STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/consultations`, {
      headers: { cookie: sessionCookie }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.consultations)).toBe(true)
    expect(data.consultations.some(function (c) { return c.id === insertedId.toString() })).toBe(true)
  })

  RUN_DB_TEST('returns the lecturer upcoming consultations', async function () {
    await connectToDatabase()
    const { insertedId } = await getCollection('Consultation').insertOne({
      attendees: [TEST_STUDENT_USERNAME],
      capacity: 1,
      datetime: futureDatetime(),
      lecturerId: TEST_LECTURER_USERNAME,
      organiserId: TEST_STUDENT_USERNAME,
      title: 'Integration lecturer cancel test consultation'
    })

    const sessionCookie = await loginAs(baseUrl, { password: LECTURER_PASSWORD, username: TEST_LECTURER_USERNAME })
    const response = await fetch(`${baseUrl}/consultations`, {
      headers: { cookie: sessionCookie }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.consultations)).toBe(true)
    expect(data.consultations.some(function (c) { return c.id === insertedId.toString() })).toBe(true)
  })

  RUN_DB_TEST('deletes the consultation and returns success when the lecturer cancels', async function () {
    await connectToDatabase()
    const { insertedId } = await getCollection('Consultation').insertOne({
      attendees: [TEST_STUDENT_USERNAME],
      capacity: 1,
      datetime: futureDatetime(),
      lecturerId: TEST_LECTURER_USERNAME,
      organiserId: TEST_STUDENT_USERNAME,
      title: 'Consultation to be cancelled by lecturer'
    })

    const sessionCookie = await loginAs(baseUrl, { password: LECTURER_PASSWORD, username: TEST_LECTURER_USERNAME })
    const response = await fetch(`${baseUrl}/consultations/${insertedId.toString()}`, {
      headers: { cookie: sessionCookie },
      method: 'DELETE'
    })
    const data = await response.json()

    await connectToDatabase()
    const remaining = await getCollection('Consultation').findOne({ _id: insertedId })

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(remaining).toBeNull()
  })

  RUN_DB_TEST('deletes the consultation and returns success when the organiser cancels', async function () {
    await connectToDatabase()
    const { insertedId } = await getCollection('Consultation').insertOne({
      attendees: [TEST_STUDENT_USERNAME],
      capacity: 1,
      datetime: futureDatetime(),
      lecturerId: TEST_LECTURER_USERNAME,
      organiserId: TEST_STUDENT_USERNAME,
      title: 'Consultation to be cancelled'
    })

    const sessionCookie = await loginAs(baseUrl, { password: STUDENT_PASSWORD, username: TEST_STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/consultations/${insertedId.toString()}`, {
      headers: { cookie: sessionCookie },
      method: 'DELETE'
    })
    const data = await response.json()

    await connectToDatabase()
    const remaining = await getCollection('Consultation').findOne({ _id: insertedId })

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(remaining).toBeNull()
  })
})

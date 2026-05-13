const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const app = require('../../src/app')

const STUDENT_PASSWORD = 'password'
const LECTURER_PASSWORD = 'password1'
const SEEDED_STUDENT_USERNAME = 'user'
const SEEDED_LECTURER_USERNAME = 'user1'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_STUDENT_USERNAME = `iteststud${TEST_ID}follow`
const TEST_LECTURER_USERNAME = `itestlect${TEST_ID}follow`
const TEST_UNIVERSITY_ID = `integration-follow-university-${TEST_ID}`
const TEST_TITLE_PREFIX = `integration-follow-consultation-${TEST_ID}`
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
  const pad = function (value) {
    return String(value).padStart(2, '0')
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:00`
}

describe('follow lecturers integration flow', () => {
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
      throw new Error('Seeded users for follow lecturer integration tests were not found.')
    }

    const { _id: _sid, username: _su, email: _se, followedLecturers: _sf, ...studentFields } = seededStudent
    const { _id: _lid, username: _lu, email: _le, ...lecturerFields } = seededLecturer

    await users.deleteMany({ username: { $in: [TEST_STUDENT_USERNAME, TEST_LECTURER_USERNAME] } })
    await users.insertMany([
      {
        ...studentFields,
        email: `${TEST_STUDENT_USERNAME}@example.test`,
        followedLecturers: [],
        role: 'student',
        universityId: TEST_UNIVERSITY_ID,
        username: TEST_STUDENT_USERNAME
      },
      {
        ...lecturerFields,
        email: `${TEST_LECTURER_USERNAME}@example.test`,
        universityId: TEST_UNIVERSITY_ID,
        username: TEST_LECTURER_USERNAME
      }
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
    await getCollection('Consultation').deleteMany({
      $or: [
        { lecturerId: TEST_LECTURER_USERNAME },
        { organiserId: TEST_STUDENT_USERNAME },
        { title: { $regex: `^${TEST_TITLE_PREFIX}` } }
      ]
    })
    await getCollection('User').updateOne(
      { username: TEST_STUDENT_USERNAME },
      { $set: { followedLecturers: [] } }
    )
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    await getCollection('Consultation').deleteMany({
      $or: [
        { lecturerId: TEST_LECTURER_USERNAME },
        { organiserId: TEST_STUDENT_USERNAME },
        { title: { $regex: `^${TEST_TITLE_PREFIX}` } }
      ]
    })
    await getCollection('User').deleteMany({ username: { $in: [TEST_STUDENT_USERNAME, TEST_LECTURER_USERNAME] } })

    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('redirects unauthenticated visitors to login when following a lecturer', async function () {
    const response = await fetch(`${baseUrl}/users/${TEST_LECTURER_USERNAME}/follow`, {
      method: 'POST',
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  RUN_DB_TEST('persists a followed lecturer for an authenticated student', async function () {
    const sessionCookie = await loginAs(baseUrl, { password: STUDENT_PASSWORD, username: TEST_STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/users/${TEST_LECTURER_USERNAME}/follow`, {
      headers: {
        accept: 'text/html',
        cookie: sessionCookie
      },
      method: 'POST',
      redirect: 'manual'
    })

    await connectToDatabase()
    const updatedStudent = await getCollection('User').findOne({ username: TEST_STUDENT_USERNAME })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/home')
    expect(updatedStudent?.followedLecturers).toContain(TEST_LECTURER_USERNAME)
  })

  RUN_DB_TEST('blocks authenticated lecturer users from following lecturers', async function () {
    const sessionCookie = await loginAs(baseUrl, { password: LECTURER_PASSWORD, username: TEST_LECTURER_USERNAME })
    const response = await fetch(`${baseUrl}/users/${TEST_LECTURER_USERNAME}/follow`, {
      headers: {
        accept: 'application/json',
        cookie: sessionCookie
      },
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data).toEqual({ error: 'Only students can follow lecturers.', success: false })
  })

  RUN_DB_TEST('shows followed lecturers and their consultations on the student home page', async function () {
    const datetime = futureDatetime()
    const title = `${TEST_TITLE_PREFIX}-dashboard`

    await connectToDatabase()
    await getCollection('User').updateOne(
      { username: TEST_STUDENT_USERNAME },
      { $set: { followedLecturers: [TEST_LECTURER_USERNAME] } }
    )
    await getCollection('Consultation').insertOne({
      attendees: [],
      capacity: 5,
      datetime,
      lecturerId: TEST_LECTURER_USERNAME,
      organiserId: TEST_STUDENT_USERNAME,
      title
    })

    const sessionCookie = await loginAs(baseUrl, { password: STUDENT_PASSWORD, username: TEST_STUDENT_USERNAME })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Following')
    expect(body).toContain('Upcoming from followed lecturers')
    expect(body).toContain(`href="/user_profile?user=${TEST_LECTURER_USERNAME}"`)
    expect(body).toContain(`href="/join_consultation?lecturerId=${TEST_LECTURER_USERNAME}"`)
    expect(body).toContain(title)
    expect(body).toContain('Open Consultation')
  })
})

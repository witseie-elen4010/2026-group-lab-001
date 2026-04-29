const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const { setLecturerAvailability } = require('../../src/models/lecturer_availability_db')
const app = require('../../src/app')

const PASSWORD = 'password'
const SEEDED_LECTURER_USERNAME = 'user1'
const SEEDED_STUDENT_USERNAME = 'user'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_LECTURER_USERNAME = `itestlect${TEST_ID}x`
const TEST_STUDENT_USERNAME = `iteststud${TEST_ID}y`
const TEST_UNIVERSITY_ID = `integration-consultation-university-${TEST_ID}`
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
    body: encodeForm({
      password,
      username
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    method: 'POST',
    redirect: 'manual'
  })

  return response.headers.get('set-cookie')?.split(';')[0] || ''
}

const setLecturerSchedule = async function (overrides = {}) {
  await connectToDatabase()
  await setLecturerAvailability(TEST_LECTURER_USERNAME, {
    dailyMax: 3,
    duration: 60,
    exceptionDates: [],
    maxStudents: 10,
    minStudents: 1,
    weeklyAvailability: [
      { day: 'monday', startTime: '08:00', endTime: '12:00' },
      { day: 'tuesday', startTime: '08:00', endTime: '12:00' },
      { day: 'wednesday', startTime: '08:00', endTime: '12:00' },
      { day: 'thursday', startTime: '08:00', endTime: '12:00' },
      { day: 'friday', startTime: '08:00', endTime: '12:00' }
    ],
    ...overrides
  })
}

const nextWeekdayAtHour = function (hour) {
  const result = new Date()
  result.setSeconds(0, 0)
  result.setMinutes(0)
  result.setHours(hour)
  result.setDate(result.getDate() + 1)

  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1)
  }

  return result
}

const toDatetimeLocal = function (date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const submitConsultation = async function (baseUrl, sessionCookie, fields) {
  return fetch(`${baseUrl}/consultations`, {
    body: encodeForm(fields),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: sessionCookie
    },
    method: 'POST'
  })
}

describe('create consultation integration flow', () => {
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
      throw new Error('Seeded users for create consultation integration tests were not found.')
    }

    const { _id: seededStudentId, username: seededStudentUsername, email: seededStudentEmail, ...studentFields } = seededStudent
    const { _id: seededLecturerId, username: seededLecturerUsername, email: seededLecturerEmail, ...lecturerFields } = seededLecturer

    await users.deleteMany({
      username: {
        $in: [TEST_LECTURER_USERNAME, TEST_STUDENT_USERNAME]
      }
    })

    await users.insertMany([
      {
        ...studentFields,
        email: `${TEST_STUDENT_USERNAME}@example.test`,
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
        { organiserId: TEST_STUDENT_USERNAME }
      ]
    })
    await getCollection('LecturerAvailability').deleteOne({ username: TEST_LECTURER_USERNAME })
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    await getCollection('Consultation').deleteMany({
      $or: [
        { lecturerId: TEST_LECTURER_USERNAME },
        { organiserId: TEST_STUDENT_USERNAME }
      ]
    })
    await getCollection('LecturerAvailability').deleteOne({ username: TEST_LECTURER_USERNAME })
    await getCollection('User').deleteMany({
      username: {
        $in: [TEST_LECTURER_USERNAME, TEST_STUDENT_USERNAME]
      }
    })

    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('rejects creation when the selected time is outside lecturer availability', async function () {
    const title = `Outside Availability ${Date.now()}`

    await setLecturerSchedule({
      weeklyAvailability: [{ day: 'monday', startTime: '08:00', endTime: '09:00' }]
    })

    const sessionCookie = await loginAs(baseUrl, {
      password: PASSWORD,
      username: TEST_STUDENT_USERNAME
    })
    const response = await submitConsultation(baseUrl, sessionCookie, {
      datetime: toDatetimeLocal(nextWeekdayAtHour(10)),
      lecturerId: TEST_LECTURER_USERNAME,
      title
    })
    const body = await response.text()

    await connectToDatabase()
    const createdConsultation = await getCollection('Consultation').findOne({ title })

    expect(response.status).toBe(400)
    expect(body).toContain('The selected time is outside this lecturer&#39;s consultation availability.')
    expect(createdConsultation).toBeNull()
  })

  RUN_DB_TEST('rejects creation when the lecturer has not set availability', async function () {
    const title = `No Availability ${Date.now()}`
    const sessionCookie = await loginAs(baseUrl, {
      password: PASSWORD,
      username: TEST_STUDENT_USERNAME
    })
    const response = await submitConsultation(baseUrl, sessionCookie, {
      datetime: toDatetimeLocal(nextWeekdayAtHour(9)),
      lecturerId: TEST_LECTURER_USERNAME,
      title
    })
    const body = await response.text()

    await connectToDatabase()
    const createdConsultation = await getCollection('Consultation').findOne({ title })

    expect(response.status).toBe(400)
    expect(body).toContain('This lecturer has not set consultation availability yet.')
    expect(createdConsultation).toBeNull()
  })

  RUN_DB_TEST('rejects creation when the lecturer has reached the daily consultation limit', async function () {
    const title = `Daily Max ${Date.now()}`
    const requestedDate = nextWeekdayAtHour(9)
    const isoDate = toDatetimeLocal(requestedDate).slice(0, 10)

    await setLecturerSchedule({ dailyMax: 2 })
    await connectToDatabase()
    await getCollection('Consultation').insertMany([
      {
        attendees: [TEST_STUDENT_USERNAME],
        capacity: 1,
        datetime: `${isoDate}T08:00`,
        lecturerId: TEST_LECTURER_USERNAME,
        organiserId: TEST_STUDENT_USERNAME,
        title: `Existing Consultation A ${Date.now()}`
      },
      {
        attendees: [TEST_STUDENT_USERNAME],
        capacity: 1,
        datetime: `${isoDate}T10:00`,
        lecturerId: TEST_LECTURER_USERNAME,
        organiserId: TEST_STUDENT_USERNAME,
        title: `Existing Consultation B ${Date.now()}`
      }
    ])

    const sessionCookie = await loginAs(baseUrl, {
      password: PASSWORD,
      username: TEST_STUDENT_USERNAME
    })
    const response = await submitConsultation(baseUrl, sessionCookie, {
      datetime: toDatetimeLocal(requestedDate),
      lecturerId: TEST_LECTURER_USERNAME,
      title
    })
    const body = await response.text()
    const createdConsultation = await getCollection('Consultation').findOne({ title })

    expect(response.status).toBe(400)
    expect(body).toContain('This lecturer has reached their consultation limit for the selected date.')
    expect(createdConsultation).toBeNull()
  })

  RUN_DB_TEST('rejects creation on a lecturer exception date', async function () {
    const title = `Exception Date ${Date.now()}`
    const requestedDate = nextWeekdayAtHour(9)
    const exceptionDate = toDatetimeLocal(requestedDate).slice(0, 10)

    await setLecturerSchedule({ exceptionDates: [exceptionDate] })

    const sessionCookie = await loginAs(baseUrl, {
      password: PASSWORD,
      username: TEST_STUDENT_USERNAME
    })
    const response = await submitConsultation(baseUrl, sessionCookie, {
      datetime: toDatetimeLocal(requestedDate),
      lecturerId: TEST_LECTURER_USERNAME,
      title
    })
    const body = await response.text()

    await connectToDatabase()
    const createdConsultation = await getCollection('Consultation').findOne({ title })

    expect(response.status).toBe(400)
    expect(body).toContain('This lecturer is unavailable on the selected date.')
    expect(createdConsultation).toBeNull()
  })
})

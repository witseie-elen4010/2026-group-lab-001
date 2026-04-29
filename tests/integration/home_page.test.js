const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const { getLecturerAvailability, setLecturerAvailability } = require('../../src/models/lecturer_availability_db')
const app = require('../../src/app')

const FACULTY_NAME = 'Engineering and the Built Environment'
const LECTURER_PASSWORD = 'password1'
const LECTURER_USERNAME = 'user1'
const RUN_DB_TEST = process.env.MONGODB_URI ? test : test.skip
const SCHOOL_NAME = 'Electrical and Information Engineering'
const STUDENT_PASSWORD = 'password'
const STUDENT_USERNAME = 'user'
const TEST_PREFIX = `homeitest${process.pid}${Date.now()}`
const UNIVERSITY_NAME = 'University of the Witwatersrand'

let baseUrl
let originalLecturerPreferences
let server

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

const getCurrentMonthDate = function (dayNumber, referenceDate = new Date()) {
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
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

describe('home page integration flow', () => {
  beforeAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    originalLecturerPreferences = await getLecturerAvailability(LECTURER_USERNAME)

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
    await getCollection('User').deleteMany({ username: { $regex: `^${TEST_PREFIX}` } })

    if (originalLecturerPreferences) {
      await setLecturerAvailability(LECTURER_USERNAME, originalLecturerPreferences)
      return
    }

    await getCollection('LecturerAvailability').deleteOne({ username: LECTURER_USERNAME })
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    await getCollection('User').deleteMany({ username: { $regex: `^${TEST_PREFIX}` } })

    if (originalLecturerPreferences) {
      await setLecturerAvailability(LECTURER_USERNAME, originalLecturerPreferences)
    } else {
      await getCollection('LecturerAvailability').deleteOne({ username: LECTURER_USERNAME })
    }

    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('returns paginated lecturer JSON results for a student search query', async function () {
    await connectToDatabase()
    await getCollection('User').insertMany(Array.from({ length: 21 }, function (_, index) {
      return {
        email: `${TEST_PREFIX}_${index}@example.com`,
        facultyId: FACULTY_NAME,
        firstName: `Home Search ${index}`,
        lastName: 'Lecturer',
        passwordHash: 'not-used',
        role: 'lecturer',
        schoolId: SCHOOL_NAME,
        universityId: UNIVERSITY_NAME,
        username: `${TEST_PREFIX}_${index}`
      }
    }))

    const sessionCookie = await loginAs(baseUrl, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })

    const pageOneResponse = await fetch(`${baseUrl}/home?q=${encodeURIComponent(TEST_PREFIX)}`, {
      headers: {
        accept: 'application/json',
        cookie: sessionCookie
      }
    })
    const pageOneData = await pageOneResponse.json()

    expect(pageOneResponse.status).toBe(200)
    expect(pageOneData.lecturers).toHaveLength(20)
    expect(pageOneData.page).toBe(1)
    expect(pageOneData.totalPages).toBe(2)
    expect(pageOneData.lecturers.every(function (lecturer) {
      return lecturer.username.startsWith(TEST_PREFIX)
    })).toBe(true)

    const pageTwoResponse = await fetch(`${baseUrl}/home?q=${encodeURIComponent(TEST_PREFIX)}&page=2`, {
      headers: {
        accept: 'application/json',
        cookie: sessionCookie
      }
    })
    const pageTwoData = await pageTwoResponse.json()

    expect(pageTwoResponse.status).toBe(200)
    expect(pageTwoData.lecturers).toHaveLength(1)
    expect(pageTwoData.page).toBe(2)
    expect(pageTwoData.totalPages).toBe(2)
    expect(pageTwoData.lecturers[0].username).toBe(`${TEST_PREFIX}_20`)
  })

  RUN_DB_TEST('filters lecturer JSON results by faculty and school', async function () {
    await connectToDatabase()
    await getCollection('User').insertMany([
      {
        email: `${TEST_PREFIX}_match@example.com`,
        facultyId: FACULTY_NAME,
        firstName: 'Filter Match',
        lastName: 'Lecturer',
        passwordHash: 'not-used',
        role: 'lecturer',
        schoolId: SCHOOL_NAME,
        universityId: UNIVERSITY_NAME,
        username: `${TEST_PREFIX}_match`
      },
      {
        email: `${TEST_PREFIX}_other@example.com`,
        facultyId: 'Science',
        firstName: 'Filter Other',
        lastName: 'Lecturer',
        passwordHash: 'not-used',
        role: 'lecturer',
        schoolId: 'Physics',
        universityId: UNIVERSITY_NAME,
        username: `${TEST_PREFIX}_other`
      }
    ])

    const sessionCookie = await loginAs(baseUrl, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })

    const response = await fetch(`${baseUrl}/home?q=${encodeURIComponent(TEST_PREFIX)}&facultyId=${encodeURIComponent(FACULTY_NAME)}&schoolId=${encodeURIComponent(SCHOOL_NAME)}`, {
      headers: {
        accept: 'application/json',
        cookie: sessionCookie
      }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.lecturers).toHaveLength(1)
    expect(data.lecturers[0].username).toBe(`${TEST_PREFIX}_match`)
  })

  RUN_DB_TEST('renders lecturer availability on the home calendar', async function () {
    await connectToDatabase()
    await setLecturerAvailability(LECTURER_USERNAME, {
      dailyMax: 2,
      duration: 45,
      exceptionDates: [getCurrentMonthDate(1)],
      maxStudents: 3,
      minStudents: 1,
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }]
    })

    const sessionCookie = await loginAs(baseUrl, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    const response = await fetch(`${baseUrl}/home`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('calendar_day_available')
    expect(body).toContain('calendar_day_unavailable')
    expect(body).toContain('09:00 - 12:00')
  })
})
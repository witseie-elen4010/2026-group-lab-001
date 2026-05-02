const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const { ObjectId } = require('mongodb')
const app = require('../../src/app')
const { setLecturerAvailability } = require('../../src/models/lecturer_availability_db')

const LECTURER_USERNAME = 'user1'
const PASSWORD = 'password'
const RUN_DB_TEST = process.env.MONGODB_URI ? test : test.skip
const STUDENT_USERNAME = 'user'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_TITLE_PREFIX = 'join-consultation-integration-'
const FULL_TITLE = `${TEST_TITLE_PREFIX}full-${TEST_ID}`
const JOINED_TITLE = `${TEST_TITLE_PREFIX}joined-${TEST_ID}`
const OPEN_TITLE = `${TEST_TITLE_PREFIX}open-${TEST_ID}`
const TEST_FILTER_LECTURER_ID = `itestfiltlect${TEST_ID}`
const MONDAY_DATE = '2030-05-06'

let baseUrl
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

const deleteTestConsultations = async function () {
  await connectToDatabase()
  await getCollection('Consultation').deleteMany({
    title: { $regex: `^${TEST_TITLE_PREFIX}` }
  })
}

describe('join consultation integration flow', () => {
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

  RUN_DB_TEST('renders the join consultation page with open, full, and joined consultations', async function () {
    await connectToDatabase()
    await getCollection('Consultation').insertMany([
      {
        attendees: ['user3'],
        capacity: 5,
        datetime: '2030-04-30T07:45',
        lecturerId: LECTURER_USERNAME,
        organiserId: 'user3',
        title: OPEN_TITLE
      },
      {
        attendees: ['user3', 'user4', 'user5'],
        capacity: 3,
        datetime: '2030-04-30T07:45',
        lecturerId: LECTURER_USERNAME,
        organiserId: 'user3',
        title: FULL_TITLE
      },
      {
        attendees: [STUDENT_USERNAME],
        capacity: 1,
        datetime: '2030-01-01T08:00',
        lecturerId: LECTURER_USERNAME,
        organiserId: STUDENT_USERNAME,
        title: JOINED_TITLE
      }
    ])

    const sessionCookie = await loginAs(baseUrl, {
      password: PASSWORD,
      username: STUDENT_USERNAME
    })

    const response = await fetch(`${baseUrl}/join_consultation`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Join Consultation</title>')
    expect(body).toContain(OPEN_TITLE)
    expect(body).toContain(FULL_TITLE)
    expect(body).toContain(JOINED_TITLE)
    expect(body).toContain('2030-01-01')
    expect(body).toContain('1/5')
    expect(body).toContain('3/3')
    expect(body).toContain('Join')
    expect(body).toContain('Closed')
    expect(body).toContain('Joined')
  })

  describe('filter and empty-state', function () {
    beforeEach(async function () {
      if (!process.env.MONGODB_URI) {
        return
      }

      await connectToDatabase()
      await getCollection('LecturerAvailability').deleteOne({ username: TEST_FILTER_LECTURER_ID })
      await setLecturerAvailability(TEST_FILTER_LECTURER_ID, {
        duration: 60,
        exceptionDates: [],
        weeklyAvailability: [{ day: 'monday', startTime: '08:00', endTime: '12:00' }]
      })
    })

    afterEach(async function () {
      if (!process.env.MONGODB_URI) {
        return
      }

      await connectToDatabase()
      await getCollection('LecturerAvailability').deleteOne({ username: TEST_FILTER_LECTURER_ID })
    })

    RUN_DB_TEST('filters consultations by lecturerId', async function () {
      const FILTER_TITLE = `${TEST_TITLE_PREFIX}filter-lecturer-${TEST_ID}`
      const OTHER_TITLE = `${TEST_TITLE_PREFIX}filter-other-${TEST_ID}`

      await connectToDatabase()
      await getCollection('Consultation').insertMany([
        {
          attendees: [],
          capacity: 5,
          datetime: `${MONDAY_DATE}T09:00`,
          lecturerId: TEST_FILTER_LECTURER_ID,
          organiserId: STUDENT_USERNAME,
          title: FILTER_TITLE
        },
        {
          attendees: [],
          capacity: 5,
          datetime: `${MONDAY_DATE}T09:00`,
          lecturerId: LECTURER_USERNAME,
          organiserId: STUDENT_USERNAME,
          title: OTHER_TITLE
        }
      ])

      const sessionCookie = await loginAs(baseUrl, { password: PASSWORD, username: STUDENT_USERNAME })
      const response = await fetch(`${baseUrl}/join_consultation?lecturerId=${TEST_FILTER_LECTURER_ID}`, {
        headers: { cookie: sessionCookie }
      })
      const body = await response.text()

      expect(response.status).toBe(200)
      expect(body).toContain(FILTER_TITLE)
      expect(body).not.toContain(OTHER_TITLE)
    })

    RUN_DB_TEST('shows the create empty state for a valid lecturer and date', async function () {
      const sessionCookie = await loginAs(baseUrl, { password: PASSWORD, username: STUDENT_USERNAME })
      const response = await fetch(
        `${baseUrl}/join_consultation?lecturerId=${TEST_FILTER_LECTURER_ID}&date=${MONDAY_DATE}`,
        { headers: { cookie: sessionCookie } }
      )
      const body = await response.text()

      expect(response.status).toBe(200)
      expect(body).toContain('No matching consultations')
      expect(body).toContain('Create')
    })

    RUN_DB_TEST('shows the violation empty state when the time is outside the lecturer schedule', async function () {
      const sessionCookie = await loginAs(baseUrl, { password: PASSWORD, username: STUDENT_USERNAME })
      const response = await fetch(
        `${baseUrl}/join_consultation?lecturerId=${TEST_FILTER_LECTURER_ID}&date=${MONDAY_DATE}&time=13%3A00`,
        { headers: { cookie: sessionCookie } }
      )
      const body = await response.text()

      expect(response.status).toBe(200)
      expect(body).toContain('Violates lecturer preferences')
    })
  })

  RUN_DB_TEST('returns the mapped join error when a consultation is full', async function () {
    await connectToDatabase()
    const insertResult = await getCollection('Consultation').insertOne({
      attendees: ['user3', 'user4', 'user5'],
      capacity: 3,
      datetime: '2030-04-30T07:45',
      lecturerId: LECTURER_USERNAME,
      organiserId: 'user3',
      title: FULL_TITLE
    })
    const consultationId = new ObjectId(insertResult.insertedId).toString()
    const sessionCookie = await loginAs(baseUrl, {
      password: PASSWORD,
      username: STUDENT_USERNAME
    })

    const response = await fetch(`${baseUrl}/join_consultation/${consultationId}/join`, {
      headers: {
        accept: 'application/json',
        cookie: sessionCookie
      },
      method: 'POST'
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      error: 'This consultation is already full.',
      success: false
    })
  })
})

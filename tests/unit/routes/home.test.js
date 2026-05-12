jest.mock('../../../src/models/db', () => ({
  closeDatabaseConnection: jest.fn(),
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
  DATABASE_NAME: 'LetsTalk',
  getCollection: jest.fn(),
  getDb: jest.fn(),
  getMongoUri: jest.fn()
}))

jest.mock('../../../src/models/lecturer_availability_db', () => ({
  getLecturerAvailability: jest.fn()
}))

jest.mock('../../../src/models/user_db', () => ({
  addUser: jest.fn(),
  deleteUser: jest.fn(),
  getLecturersByUsernames: jest.fn(),
  getUser: jest.fn(),
  searchLecturers: jest.fn()
}))

jest.mock('../../../src/models/consultation_db', () => ({
  getConsultationsForCalendar: jest.fn(),
  getUpcomingConsultationsForFollowedLecturers: jest.fn(),
  getUpcomingConsultationsForLecturer: jest.fn(),
  JOIN_RESULT_REASONS: {
    ALREADY_JOINED: 'already_joined',
    FULL: 'full',
    NOT_FOUND: 'not_found'
  },
  addConsultation: jest.fn()
}))

const http = require('node:http')

const closeServer = async function (server) {
  if (!server) {
    return
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
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

const { connectToDatabase } = require('../../../src/models/db')
const { getLecturerAvailability } = require('../../../src/models/lecturer_availability_db')
const { getLecturersByUsernames, getUser, searchLecturers } = require('../../../src/models/user_db')
const { addConsultation, getConsultationsForCalendar, getUpcomingConsultationsForFollowedLecturers, getUpcomingConsultationsForLecturer } = require('../../../src/models/consultation_db')
const { hashPassword } = require('../../../src/utils/password')
const app = require('../../../src/app')

let baseUrl

const MONTH_LABELS = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
])

const MOCK_LECTURERS = [
  { username: 'alice', firstName: 'Alice', lastName: 'Smith', facultyId: 'Engineering', schoolId: 'EIE' },
  { username: 'bob', firstName: 'Bob', lastName: 'Jones', facultyId: 'Science', schoolId: 'Physics' }
]

const MOCK_LECTURERS_21 = Array.from({ length: 21 }, function (_, i) {
  return { username: `lecturer${i}`, firstName: `First${i}`, lastName: `Last${i}`, facultyId: 'Engineering', schoolId: 'EIE' }
})

const MOCK_FOLLOWED_CONSULTATIONS = [
  {
    date: '2030-05-14',
    hasJoined: false,
    id: 'consultation-1',
    isFull: false,
    lecturer: 'Alice Smith',
    lecturerId: 'alice',
    name: 'Signals Consultation',
    startTime: '09:00',
    time: '09:00 to 09:30'
  }
]

/**
 * Encodes form fields for URL-encoded POST requests.
 * @param {Record<string, string>} fields - Form fields to encode.
 * @returns {string} URL-encoded form payload.
 */
const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

/**
 * Extracts the session cookie value from a Set-Cookie header.
 * @param {string|null} setCookieHeader - Raw Set-Cookie header value.
 * @returns {string} Session cookie header value.
 */
const getSessionCookie = function (setCookieHeader) {
  return setCookieHeader?.split(';')[0] || ''
}

/**
 * Logs in and returns the session cookie for protected route tests.
 * @param {object} options - Login user details.
 * @param {string} [options.role='student'] - User role to store in the session.
 * @param {string} [options.username='morris'] - Username used for login.
 * @param {string} [options.universityId=''] - University stored in the session.
 * @returns {Promise<{loginResponse: Response, sessionCookie: string}>} Login response and session cookie.
 */
const loginAs = async function ({ role = 'student', username = 'morris', universityId = '' } = {}) {
  getUser.mockResolvedValueOnce({
    passwordHash: await hashPassword('welovesd3'),
    role,
    universityId,
    username
  })

  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: encodeForm({
      password: 'welovesd3',
      username
    }),
    redirect: 'manual'
  })

  return {
    loginResponse,
    sessionCookie: getSessionCookie(loginResponse.headers.get('set-cookie'))
  }
}

/**
 * Returns the current month label used on the home page calendar.
 * @param {Date} [referenceDate=new Date()] - Date used to choose the month label.
 * @returns {string} Current month label.
 */
const getCurrentMonthLabel = function (referenceDate = new Date()) {
  return `${MONTH_LABELS[referenceDate.getMonth()]} ${referenceDate.getFullYear()}`
}

/**
 * Returns a YYYY-MM-DD string for the current month.
 * @param {number} dayNumber - Day number in the current month.
 * @param {Date} [referenceDate=new Date()] - Date used to choose the month.
 * @returns {string} ISO date string.
 */
const getCurrentMonthDate = function (dayNumber, referenceDate = new Date()) {
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
}

describe('home route', () => {
  let server

  beforeAll(async () => {
    server = http.createServer(app)
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  afterAll(async () => {
    await closeServer(server)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    addConsultation.mockResolvedValue({ acknowledged: true, insertedId: 'consultation-id' })
    connectToDatabase.mockResolvedValue(undefined)
    getConsultationsForCalendar.mockResolvedValue([])
    getLecturersByUsernames.mockResolvedValue([])
    getUpcomingConsultationsForFollowedLecturers.mockResolvedValue([])
    getUpcomingConsultationsForLecturer.mockResolvedValue([])
    getLecturerAvailability.mockResolvedValue(null)
    getUser.mockResolvedValue({ followedLecturers: [], role: 'student', username: 'morris' })
    searchLecturers.mockResolvedValue([])
  })

  test('Redirects unauthenticated users to login when requesting the home page', async () => {
    const response = await fetch(`${baseUrl}/home`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(getUser).not.toHaveBeenCalled()
  })

  test('Renders the student home page after a successful login', async () => {
    const { loginResponse, sessionCookie } = await loginAs({
      role: 'student',
      username: 'morris'
    })
    const response = await fetch(`${baseUrl}/home`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()
    const currentMonthLabel = getCurrentMonthLabel()

    expect(loginResponse.status).toBe(302)
    expect(loginResponse.headers.get('location')).toBe('/home')
    expect(response.status).toBe(200)
    expect(body).toContain('<title>Student Home</title>')
    expect(body).toContain('Hello morris')
    expect(body).toContain('You are logged in as a student.')
    expect(body).toContain('Choose an option below.')
    expect(body).toContain('User Profile')
    expect(body).toContain('Create Consultation')
    expect(body).toContain('/user_profile?user=morris')
    expect(body).toContain('href="/consultations/new"')
    expect(body).not.toContain('View Logs')
    expect(body).toContain(currentMonthLabel)
    expect(body).toContain('calendar_table')
    expect(body).toContain('Sun')
    expect(body).toContain('Sat')
    expect(getLecturerAvailability).not.toHaveBeenCalled()
  })

  test('Renders the admin home page with the logs button', async () => {
    const { loginResponse, sessionCookie } = await loginAs({
      role: 'admin',
      username: 'user'
    })
    const response = await fetch(`${baseUrl}/home`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(loginResponse.status).toBe(302)
    expect(loginResponse.headers.get('location')).toBe('/home')
    expect(response.status).toBe(200)
    expect(body).toContain('<title>Admin Home</title>')
    expect(body).toContain('Hello user')
    expect(body).toContain('You are logged in as a admin.')
    expect(body).toContain('Create Consultation')
    expect(body).toContain('Join Consultation')
    expect(body).toContain('View Logs')
    expect(body).toContain('href="/logs"')
  })

  test('Renders the lecturer home page after a successful login', async () => {
    const { loginResponse, sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })
    const response = await fetch(`${baseUrl}/home`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()
    const currentMonthLabel = getCurrentMonthLabel()

    expect(loginResponse.status).toBe(302)
    expect(loginResponse.headers.get('location')).toBe('/home')
    expect(response.status).toBe(200)
    expect(body).toContain('<title>Lecturer Home</title>')
    expect(body).toContain('Hello lecturer1')
    expect(body).toContain('You are logged in as a lecturer.')
    expect(body).toContain('Choose an option below.')
    expect(body).toContain('User Profile')
    expect(body).toContain('/user_profile?user=lecturer1')
    expect(body).not.toContain('View Logs')
    expect(body).toContain(currentMonthLabel)
    expect(body).toContain('calendar_table')
  })

  test('Denies non-admin users access to the logs page', async () => {
    const { sessionCookie } = await loginAs({
      role: 'student',
      username: 'morris'
    })

    const response = await fetch(`${baseUrl}/logs`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(403)
    expect(body).toContain('Only the admin can view logs.')
  })

  test('Highlights lecturer availability on the home calendar', async () => {
    const { sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })
    getLecturerAvailability.mockResolvedValue({
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }],
      exceptionDates: [getCurrentMonthDate(1)]
    })

    const response = await fetch(`${baseUrl}/home`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(getLecturerAvailability).toHaveBeenCalledWith('lecturer1')
    expect(body).toContain('calendar_day_available')
    expect(body).toContain('calendar_day_unavailable')
    expect(body).toContain('09:00 - 12:00')
    expect(body).toContain('Unavailable')
  })

  test('Redirects unauthenticated users to login when requesting the create consultation page', async () => {
    const response = await fetch(`${baseUrl}/consultations/new`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  test('Renders the create consultation page', async () => {
    const { sessionCookie } = await loginAs({
      role: 'student',
      username: 'morris',
      universityId: 'Wits'
    })
    searchLecturers.mockResolvedValueOnce(MOCK_LECTURERS)

    const response = await fetch(`${baseUrl}/consultations/new`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Create Consultation</title>')
    expect(body).toContain('Create Consultation')
    expect(body).toContain('Hello morris')
    expect(body).toContain('action="/consultations"')
    expect(body).toContain('name="title"')
    expect(body).toContain('name="lecturerId"')
    expect(body).toContain('name="datetime"')
    expect(body).toContain('Alice Smith')
    expect(body).toContain('Bob Jones')
    expect(body).toContain('href="/home"')
    expect(searchLecturers).toHaveBeenCalledWith({ universityId: 'Wits' })
  })

  test('Redirects unauthenticated users to login when requesting the scheduled consultations page', async () => {
    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  test('Renders the scheduled consultations page', async () => {
    getUpcomingConsultationsForLecturer.mockResolvedValueOnce([
      {
        date: '2030-05-04',
        id: 'consultation-1',
        name: 'Project check-in',
        organiser: 'morris',
        roster: ['Alice Smith', 'Brian Molefe'],
        time: '09:00 to 09:30'
      }
    ])

    const { sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })
    connectToDatabase.mockClear()

    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Lecturer Dashboard</title>')
    expect(body).toContain('Lecturer Dashboard')
    expect(body).toContain('View your upcoming consultations and calendar in one place.')
    expect(body).toContain('Upcoming Consultations')
    expect(body).toContain('Calendar')
    expect(body).toContain('Project check-in')
    expect(body).toContain('morris')
    expect(body).toContain('2030-05-04')
    expect(body).toContain('09:00 to 09:30')
    expect(body).toContain('Attendee roster')
    expect(body).toContain('Alice Smith')
    expect(body).toContain('Brian Molefe')
    expect(body).toContain('calendar_table')
    expect(body).toContain('calendar_day_note_dashboard')
    expect(body).toContain('href="/home"')
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(getUpcomingConsultationsForLecturer).toHaveBeenCalledWith('lecturer1')
  })

  test('Renders an empty roster message when a consultation has no confirmed attendees', async () => {
    getUpcomingConsultationsForLecturer.mockResolvedValueOnce([
      {
        date: '2030-05-04',
        id: 'consultation-1',
        name: 'Project check-in',
        organiser: 'morris',
        roster: [],
        time: '09:00 to 09:30'
      }
    ])

    const { sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })

    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No confirmed students booked for this session yet.')
  })

  test('Renders an empty lecturer dashboard when there are no upcoming consultations', async () => {
    const { sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })
    connectToDatabase.mockClear()

    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No upcoming consultations yet.')
    expect(body).toContain('calendar_table')
    expect(body).toContain(getCurrentMonthLabel())
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(getUpcomingConsultationsForLecturer).toHaveBeenCalledWith('lecturer1')
  })

  test('Renders the dashboard calendar month from the earliest upcoming consultation', async () => {
    getUpcomingConsultationsForLecturer.mockResolvedValueOnce([
      {
        date: '2030-06-05',
        id: 'consultation-1',
        name: 'Signals review',
        organiser: 'morris',
        time: '09:00 to 09:30'
      },
      {
        date: '2030-06-11',
        id: 'consultation-2',
        name: 'Project prep',
        organiser: 'sam',
        time: '10:00 to 10:30'
      }
    ])

    const { sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })

    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain(getCurrentMonthLabel(new Date('2030-06-01T00:00')))
    expect(body).toContain('Signals review')
    expect(body).toContain('Project prep')
    expect(body).toContain('calendar_day_note_dashboard')
  })

  test('Shows an error when the lecturer dashboard cannot be loaded', async () => {
    getUpcomingConsultationsForLecturer.mockRejectedValueOnce(new Error('dashboard failed'))

    const { sessionCookie } = await loginAs({
      role: 'lecturer',
      username: 'lecturer1'
    })

    const response = await fetch(`${baseUrl}/scheduled_consultations`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).toContain('Unable to load upcoming consultations right now.')
    expect(body).not.toContain('No upcoming consultations yet.')
    expect(body).not.toContain('dashboard_consultation_card')
  })

  test('Blocks non-lecturer users from the scheduled consultations page', async () => {
    const { sessionCookie } = await loginAs({
      role: 'student',
      username: 'morris'
    })
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

  test('Renders the home page without lecturer search for a non-student user', async () => {
    const { sessionCookie } = await loginAs({ role: 'lecturer', username: 'lectureruser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(searchLecturers).not.toHaveBeenCalled()
    expect(body).not.toContain('No lecturers found.')
  })

  test('Renders the home page with all lecturers for a student user', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alice Smith')
    expect(body).toContain('Bob Jones')
  })

  test('Passes the search query string to searchLecturers', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    await fetch(`${baseUrl}/home?q=alice`, {
      headers: { cookie: sessionCookie }
    })

    expect(searchLecturers).toHaveBeenCalledWith({ universityId: '', query: 'alice' })
  })

  test('Filters results by facultyId', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home?facultyId=Engineering`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alice Smith')
    expect(body).not.toContain('Bob Jones')
  })

  test('Filters results by schoolId', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home?schoolId=EIE`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alice Smith')
    expect(body).not.toContain('Bob Jones')
  })

  test('Shows the no results message when no lecturers match', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home?q=unknown`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No lecturers found.')
  })

  test('Renders the home page with empty results when the database throws', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    connectToDatabase.mockRejectedValue(new Error('DB error'))
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No lecturers found.')
  })

  test('Renders lecturer results as links to the user profile page', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('href="/user_profile?user=alice"')
    expect(body).toContain('href="/user_profile?user=bob"')
  })

  test('Renders follow buttons for lecturer results on the student home page', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('action="/users/alice/follow"')
    expect(body).toContain('action="/users/bob/follow"')
    expect(body).toContain('>Follow</button>')
  })

  test('Shows when a lecturer is already followed on the student home page', async () => {
    getUser.mockResolvedValue({ followedLecturers: ['alice'], role: 'student', username: 'testuser' })
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('Following')
    expect(body).not.toContain('action="/users/alice/follow"')
    expect(body).toContain('action="/users/bob/follow"')
  })

  test('Does not render follow buttons for admin lecturer results', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'admin', username: 'adminuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).not.toContain('action="/users/alice/follow"')
    expect(body).not.toContain('action="/users/bob/follow"')
    expect(body).not.toContain('Following')
  })

  test('Shows empty followed lecturer dashboard states for students with no followed lecturers', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('Follow lecturers from the search results below to pin them here.')
    expect(body).toContain('No upcoming consultations from followed lecturers.')
  })

  test('Shows followed lecturers with quick links on the student home page', async () => {
    getUser.mockResolvedValue({ followedLecturers: ['alice', 'bob'], role: 'student', username: 'testuser' })
    getLecturersByUsernames.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('Quick access to lecturers you follow and their upcoming consultations.')
    expect(body).toContain('href="/user_profile?user=alice"')
    expect(body).toContain('href="/join_consultation?lecturerId=alice"')
    expect(body).toContain('View Schedule')
    expect(body).toContain('View Consultations')
  })

  test('Shows upcoming consultations from followed lecturers on the student home page', async () => {
    getUser.mockResolvedValue({ followedLecturers: ['alice'], role: 'student', username: 'testuser' })
    getLecturersByUsernames.mockResolvedValue([MOCK_LECTURERS[0]])
    getUpcomingConsultationsForFollowedLecturers.mockResolvedValue(MOCK_FOLLOWED_CONSULTATIONS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('Upcoming from followed lecturers')
    expect(body).toContain('Signals Consultation')
    expect(body).toContain('Alice Smith')
    expect(body).toContain('09:00 to 09:30')
    expect(body).toContain('Open')
    expect(body).toContain('href="/join_consultation?lecturerId=alice&date=2030-05-14&time=09%3A00"')
  })

  test('Returns JSON lecturer results when requested with Accept application/json', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(data.lecturers).toHaveLength(2)
    expect(data.page).toBe(1)
    expect(data.totalPages).toBe(1)
  })

  test('Returns follow state in JSON lecturer results for students', async () => {
    getUser.mockResolvedValue({ followedLecturers: ['alice'], role: 'student', username: 'testuser' })
    searchLecturers.mockResolvedValue(MOCK_LECTURERS)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.lecturers).toEqual([
      expect.objectContaining({ isFollowed: true, username: 'alice' }),
      expect.objectContaining({ isFollowed: false, username: 'bob' })
    ])
  })

  test('Returns empty JSON results when the database throws and JSON is requested', async () => {
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    connectToDatabase.mockRejectedValue(new Error('DB error'))
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.lecturers).toHaveLength(0)
    expect(data.page).toBe(1)
    expect(data.totalPages).toBe(0)
  })

  test('Shows only the first 20 lecturers on page 1 when there are more than 20 results', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS_21)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(data.lecturers).toHaveLength(20)
    expect(data.page).toBe(1)
    expect(data.totalPages).toBe(2)
  })

  test('Shows the remaining lecturers on page 2', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS_21)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home?page=2`, {
      headers: { cookie: sessionCookie, accept: 'application/json' }
    })
    const data = await response.json()

    expect(data.lecturers).toHaveLength(1)
    expect(data.page).toBe(2)
    expect(data.totalPages).toBe(2)
  })

  test('Shows consultation notes on the student calendar for the current month', async () => {
    getConsultationsForCalendar.mockResolvedValue([{
      date: getCurrentMonthDate(15),
      hasJoined: false,
      id: 'cons-1',
      isFull: false,
      lecturer: 'Jane Doe',
      name: 'Project Review',
      time: '09:00 to 10:00'
    }])
    const { sessionCookie } = await loginAs({ role: 'student', username: 'morris' })
    const response = await fetch(`${baseUrl}/home`, { headers: { cookie: sessionCookie } })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Project Review')
    expect(body).toContain('Jane Doe')
    expect(body).toContain('09:00 to 10:00')
  })

  test('Shows the Joined label for a consultation the student has joined', async () => {
    getConsultationsForCalendar.mockResolvedValue([{
      date: getCurrentMonthDate(15),
      hasJoined: true,
      id: 'cons-1',
      isFull: false,
      lecturer: 'Jane Doe',
      name: 'Project Review',
      time: '09:00 to 10:00'
    }])
    const { sessionCookie } = await loginAs({ role: 'student', username: 'morris' })
    const response = await fetch(`${baseUrl}/home`, { headers: { cookie: sessionCookie } })
    const body = await response.text()

    expect(body).toContain('Joined')
    expect(body).toContain('calendar_day_note_joined')
  })

  test('Shows the Unjoined label for a consultation the student has not joined', async () => {
    getConsultationsForCalendar.mockResolvedValue([{
      date: getCurrentMonthDate(15),
      hasJoined: false,
      id: 'cons-1',
      isFull: false,
      lecturer: 'Jane Doe',
      name: 'Project Review',
      time: '09:00 to 10:00'
    }])
    const { sessionCookie } = await loginAs({ role: 'student', username: 'morris' })
    const response = await fetch(`${baseUrl}/home`, { headers: { cookie: sessionCookie } })
    const body = await response.text()

    expect(body).toContain('Unjoined')
    expect(body).toContain('calendar_day_note_unjoined')
  })

  test('Shows the Fully Booked label for a full unjoined consultation', async () => {
    getConsultationsForCalendar.mockResolvedValue([{
      date: getCurrentMonthDate(15),
      hasJoined: false,
      id: 'cons-1',
      isFull: true,
      lecturer: 'Jane Doe',
      name: 'Project Review',
      time: '09:00 to 10:00'
    }])
    const { sessionCookie } = await loginAs({ role: 'student', username: 'morris' })
    const response = await fetch(`${baseUrl}/home`, { headers: { cookie: sessionCookie } })
    const body = await response.text()

    expect(body).toContain('Fully Booked')
    expect(body).toContain('calendar_day_note_full')
  })

  test('Renders pagination links when there are more than 20 results', async () => {
    searchLecturers.mockResolvedValue(MOCK_LECTURERS_21)
    const { sessionCookie } = await loginAs({ role: 'student', username: 'testuser' })
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(body).toContain('pagination')
    expect(body).toContain('page=1')
    expect(body).toContain('page=2')
  })
})

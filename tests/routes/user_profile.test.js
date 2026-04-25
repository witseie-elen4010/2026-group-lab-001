jest.mock('../../src/models/lecturer_availability_db', () => ({
  getLecturerAvailability: jest.fn(),
  setLecturerAvailability: jest.fn()
}))

jest.mock('../../src/models/db', () => ({
  closeDatabaseConnection: jest.fn(),
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
  DATABASE_NAME: 'LetsTalk',
  getCollection: jest.fn(),
  getDb: jest.fn(),
  getMongoUri: jest.fn()
}))

jest.mock('../../src/models/user_db', () => ({
  addUser: jest.fn(),
  deleteUser: jest.fn(),
  getUser: jest.fn(),
  updateUserInstitutions: jest.fn()
}))

jest.mock('../../src/models/university_db', () => ({
  getFaculty: jest.fn(),
  getSchool: jest.fn(),
  getUniversity: jest.fn(),
  isFacultyInUniversity: jest.fn(),
  isSchoolInFaculty: jest.fn(),
  searchFaculties: jest.fn(),
  searchSchools: jest.fn(),
  searchUniversities: jest.fn()
}))

const http = require('node:http')

const { connectToDatabase } = require('../../src/models/db')
const { getUser, updateUserInstitutions } = require('../../src/models/user_db')
const { getLecturerAvailability, setLecturerAvailability } = require('../../src/models/lecturer_availability_db')
const {
  getFaculty,
  getSchool,
  getUniversity,
  isFacultyInUniversity,
  isSchoolInFaculty
} = require('../../src/models/university_db')
const { hashPassword } = require('../../src/utils/password')
const app = require('../../src/app')
let baseUrl

const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

const getSessionCookie = function (setCookieHeader) {
  return setCookieHeader?.split(';')[0] || ''
}

const buildUser = async function (overrides = {}) {
  return {
    email: 'sd3lovers@example.com',
    facultyId: 'Engineering and the Built Environment',
    firstName: 'Morris',
    lastName: 'Wits',
    passwordHash: await hashPassword('welovesd3'),
    role: 'student',
    schoolId: 'Electrical and Information Engineering',
    universityId: 'University of the Witwatersrand',
    username: 'morris',
    ...overrides
  }
}

const loginAs = async function (userOverrides = {}) {
  const loginUser = await buildUser(userOverrides)
  getUser.mockResolvedValueOnce(loginUser)
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: encodeForm({
      password: 'welovesd3',
      username: loginUser.username
    }),
    redirect: 'manual'
  })

  getUser.mockClear()
  connectToDatabase.mockClear()

  return getSessionCookie(response.headers.get('set-cookie'))
}

describe('user profile route', () => {
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
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    connectToDatabase.mockResolvedValue(undefined)
    updateUserInstitutions.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
    getUser.mockResolvedValue(await buildUser())
    getFaculty.mockResolvedValue({ name: 'Engineering and the Built Environment' })
    getSchool.mockResolvedValue({ name: 'Electrical and Information Engineering' })
    getUniversity.mockResolvedValue({ name: 'University of the Witwatersrand' })
    isFacultyInUniversity.mockResolvedValue(true)
    isSchoolInFaculty.mockResolvedValue(true)
    getLecturerAvailability.mockResolvedValue(null)
    setLecturerAvailability.mockResolvedValue(undefined)
  })

  test('Redirects unauthenticated users to login before rendering the profile page', async () => {
    const response = await fetch(`${baseUrl}/user_profile?user=morris`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('Renders the owner profile with the edit form', async () => {
    const sessionCookie = await loginAs()
    const response = await fetch(`${baseUrl}/user_profile?user=morris`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledWith('morris')
    expect(body).toContain('Hello, morris')
    expect(body).toContain('Update Institution')
    expect(body).toContain('Morris')
    expect(body).toContain('Wits')
    expect(body).toContain('sd3lovers@example.com')
    expect(body).toContain('University of the Witwatersrand')
    expect(body).toContain('Engineering and the Built Environment')
    expect(body).toContain('Electrical and Information Engineering')
    expect(body).toContain('href="/home"')
  })

  test('Renders another user profile without the edit form for the viewer', async () => {
    const sessionCookie = await loginAs()
    getUser.mockResolvedValueOnce(await buildUser({
      email: 'alice@example.com',
      facultyId: 'Faculty of Science',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'student',
      schoolId: 'School of Chemistry',
      universityId: 'University of Cape Town',
      username: 'alice'
    }))

    const response = await fetch(`${baseUrl}/user_profile?user=alice`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(getUser).toHaveBeenCalledWith('alice')
    expect(body).toContain('alice&#39;s Profile')
    expect(body).not.toContain('Update Institution')
    expect(body).toContain('alice@example.com')
    expect(body).toContain('href="/home"')
  })

  test('Redirects to login when the user does not exist', async () => {
    const sessionCookie = await loginAs()
    getUser.mockResolvedValueOnce(null)

    const response = await fetch(`${baseUrl}/user_profile?user=missing`, {
      headers: {
        cookie: sessionCookie
      },
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  test('Redirects unauthenticated users to login before updating the profile page', async () => {
    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        faculty: 'Faculty of Science',
        school: 'School of Mathematics',
        user: 'morris',
        university: 'Updated University'
      }),
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(connectToDatabase).not.toHaveBeenCalled()
  })

  test('Updates the user institution details when the selection is valid', async () => {
    const sessionCookie = await loginAs()
    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({
        faculty: 'Faculty of Science',
        school: 'School of Mathematics',
        user: 'morris',
        university: 'Updated University'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(updateUserInstitutions).toHaveBeenCalledWith('morris', {
      facultyId: 'Faculty of Science',
      schoolId: 'School of Mathematics',
      universityId: 'Updated University'
    })
    expect(body).toContain('Updated University')
    expect(body).toContain('Faculty of Science')
    expect(body).toContain('School of Mathematics')
  })

  test('Re-renders the profile page when the updated faculty is not from the database list', async () => {
    const sessionCookie = await loginAs()
    getFaculty.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({
        faculty: 'Unknown Faculty',
        school: 'Electrical and Information Engineering',
        user: 'morris',
        university: 'University of the Witwatersrand'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(updateUserInstitutions).not.toHaveBeenCalled()
    expect(body).toContain('Choose a faculty from the database list.')
  })

  test('Rejects institution updates when the viewer is not the profile owner', async () => {
    const sessionCookie = await loginAs()
    getUser.mockResolvedValueOnce(await buildUser({
      email: 'alice@example.com',
      facultyId: 'Faculty of Science',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'student',
      schoolId: 'School of Chemistry',
      universityId: 'University of Cape Town',
      username: 'alice'
    }))

    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      body: encodeForm({
        faculty: 'Faculty of Science',
        school: 'School of Mathematics',
        user: 'alice',
        university: 'Updated University'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(403)
    expect(updateUserInstitutions).not.toHaveBeenCalled()
    expect(body).toContain('You can only edit your own profile.')
    expect(body).not.toContain('Update Institution')
  })

  test('Renders the consultation preferences form when a lecturer views their own profile', async () => {
    const sessionCookie = await loginAs({ role: 'lecturer', username: 'dr_jones' })
    getUser.mockResolvedValueOnce(await buildUser({ role: 'lecturer', username: 'dr_jones' }))
    getLecturerAvailability.mockResolvedValueOnce({
      minStudents: 2,
      maxStudents: 10,
      duration: 60,
      dailyMax: 4,
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }],
      exceptionDates: ['2026-05-01']
    })

    const response = await fetch(`${baseUrl}/user_profile?user=dr_jones`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(getLecturerAvailability).toHaveBeenCalledWith('dr_jones')
    expect(body).toContain('Consultation Preferences')
    expect(body).toContain('Availability Settings')
    expect(body).toContain('name="availability_monday"')
    expect(body).toContain('2026-05-01')
    expect(body).toContain('Save Consultation Preferences')
  })

  test('Renders read-only consultation preferences when a student views a lecturer profile', async () => {
    const sessionCookie = await loginAs()
    getUser.mockResolvedValueOnce(await buildUser({ role: 'lecturer', username: 'dr_jones', email: 'dr@example.com' }))
    getLecturerAvailability.mockResolvedValueOnce({
      minStudents: 2,
      maxStudents: 10,
      duration: 60,
      dailyMax: 4,
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }],
      exceptionDates: ['2026-05-01']
    })

    const response = await fetch(`${baseUrl}/user_profile?user=dr_jones`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(getLecturerAvailability).toHaveBeenCalledWith('dr_jones')
    expect(body).toContain('Consultation Preferences')
    expect(body).toContain('Weekly Availability')
    expect(body).toContain('Monday: 09:00 - 12:00')
    expect(body).toContain('2026-05-01')
    expect(body).not.toContain('Save Consultation Preferences')
  })

  test('Does not render the consultation preferences section for student profiles', async () => {
    const sessionCookie = await loginAs()

    const response = await fetch(`${baseUrl}/user_profile?user=morris`, {
      headers: { cookie: sessionCookie }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(getLecturerAvailability).not.toHaveBeenCalled()
    expect(body).not.toContain('Consultation Preferences')
  })

  test('Saves consultation preferences and returns JSON success for an AJAX request', async () => {
    const sessionCookie = await loginAs({ role: 'lecturer', username: 'dr_jones' })
    getUser.mockResolvedValueOnce(await buildUser({ role: 'lecturer', username: 'dr_jones' }))

    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
        cookie: sessionCookie
      },
      body: encodeForm({
        formType: 'consultationPreferences',
        username: 'dr_jones',
        minStudents: '2',
        maxStudents: '10',
        duration: '60',
        dailyMax: '4',
        availability_monday: 'available',
        start_time_monday: '09:00',
        end_time_monday: '12:00',
        exceptionDates: '2026-05-01\n2026-05-02'
      })
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(setLecturerAvailability).toHaveBeenCalledWith('dr_jones', {
      minStudents: 2,
      maxStudents: 10,
      duration: 60,
      dailyMax: 4,
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }],
      exceptionDates: ['2026-05-01', '2026-05-02']
    })
    expect(data).toEqual({ success: true })
  })

  test('Returns a JSON error when an available weekday has an invalid time range', async () => {
    const sessionCookie = await loginAs({ role: 'lecturer', username: 'dr_jones' })
    getUser.mockResolvedValueOnce(await buildUser({ role: 'lecturer', username: 'dr_jones' }))

    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
        cookie: sessionCookie
      },
      body: encodeForm({
        formType: 'consultationPreferences',
        username: 'dr_jones',
        minStudents: '2',
        maxStudents: '10',
        duration: '60',
        dailyMax: '4',
        availability_monday: 'available',
        start_time_monday: '12:00',
        end_time_monday: '09:00'
      })
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(setLecturerAvailability).not.toHaveBeenCalled()
    expect(data).toEqual({ success: false, error: 'Start time must be earlier than end time for monday.' })
  })

  test('Returns a JSON error when a consultation preference value is negative', async () => {
    const sessionCookie = await loginAs({ role: 'lecturer', username: 'dr_jones' })
    getUser.mockResolvedValueOnce(await buildUser({ role: 'lecturer', username: 'dr_jones' }))

    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
        cookie: sessionCookie
      },
      body: encodeForm({ formType: 'consultationPreferences', username: 'dr_jones', minStudents: '-1', maxStudents: '10', duration: '60', dailyMax: '4' })
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(setLecturerAvailability).not.toHaveBeenCalled()
    expect(data).toEqual({ success: false, error: 'Consultation settings cannot be negative.' })
  })

  test('Returns a JSON error when minimum students exceed maximum students', async () => {
    const sessionCookie = await loginAs({ role: 'lecturer', username: 'dr_jones' })
    getUser.mockResolvedValueOnce(await buildUser({ role: 'lecturer', username: 'dr_jones' }))

    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
        cookie: sessionCookie
      },
      body: encodeForm({ formType: 'consultationPreferences', username: 'dr_jones', minStudents: '10', maxStudents: '5', duration: '60', dailyMax: '4' })
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(setLecturerAvailability).not.toHaveBeenCalled()
    expect(data).toEqual({ success: false, error: 'Minimum students cannot exceed maximum students.' })
  })

  test('Returns a JSON error when total daily consultation time exceeds 480 minutes', async () => {
    const sessionCookie = await loginAs({ role: 'lecturer', username: 'dr_jones' })
    getUser.mockResolvedValueOnce(await buildUser({ role: 'lecturer', username: 'dr_jones' }))

    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
        cookie: sessionCookie
      },
      body: encodeForm({ formType: 'consultationPreferences', username: 'dr_jones', minStudents: '2', maxStudents: '10', duration: '120', dailyMax: '5' })
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(setLecturerAvailability).not.toHaveBeenCalled()
    expect(data.success).toBe(false)
  })

  test('Returns a 403 JSON error when the viewer is not the profile owner', async () => {
    const sessionCookie = await loginAs({ role: 'lecturer', username: 'dr_jones' })
    getUser.mockResolvedValueOnce(await buildUser({ role: 'lecturer', username: 'prof_smith', email: 'prof@example.com' }))

    const response = await fetch(`${baseUrl}/user_profile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
        cookie: sessionCookie
      },
      body: encodeForm({ formType: 'consultationPreferences', username: 'prof_smith', minStudents: '2', maxStudents: '10', duration: '60', dailyMax: '4' })
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(setLecturerAvailability).not.toHaveBeenCalled()
    expect(data).toEqual({ success: false, error: 'You can only edit your own profile.' })
  })
})

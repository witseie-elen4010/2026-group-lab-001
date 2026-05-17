const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const { getLecturerAvailability, setLecturerAvailability } = require('../../src/models/lecturer_availability_db')
const { getUser, updateUserAcademicProfile, updateUserInstitutions } = require('../../src/models/user_db')
const app = require('../../src/app')

const FACULTY_NAME = 'Engineering and the Built Environment'
const LECTURER_PASSWORD = 'password1'
const LECTURER_USERNAME = 'user1'
const SCHOOL_NAME = 'Electrical and Information Engineering'
const STUDENT_PASSWORD = 'password'
const STUDENT_USERNAME = 'user'
const UNIVERSITY_NAME = 'University of the Witwatersrand'
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

describe('user profile integration flow', () => {
  let originalStudentAcademicProfile
  let baseUrl
  let originalLecturerPreferences
  let originalStudentInstitutions
  let server

  beforeAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    const originalStudent = await getUser(STUDENT_USERNAME)

    originalStudentInstitutions = {
      facultyId: originalStudent?.facultyId || FACULTY_NAME,
      schoolId: originalStudent?.schoolId || SCHOOL_NAME,
      universityId: originalStudent?.universityId || UNIVERSITY_NAME
    }
    originalStudentAcademicProfile = {
      courses: originalStudent?.courses || [],
      degree: originalStudent?.degree || ''
    }
    originalLecturerPreferences = await getLecturerAvailability(LECTURER_USERNAME)

    server = http.createServer(app)

    await new Promise(function (resolve) {
      server.listen(0, '127.0.0.1', function () {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  afterAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await closeServer(server)
    await closeDatabaseConnection()
  })

  afterEach(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    await connectToDatabase()
    await updateUserAcademicProfile(STUDENT_USERNAME, originalStudentAcademicProfile)
    await updateUserInstitutions(STUDENT_USERNAME, originalStudentInstitutions)

    if (originalLecturerPreferences) {
      await setLecturerAvailability(LECTURER_USERNAME, originalLecturerPreferences)
      return
    }

    await getCollection('LecturerAvailability').deleteOne({ username: LECTURER_USERNAME })
  })

  RUN_DB_TEST('redirects unauthenticated visitors to login', async function () {
    const response = await fetch(`${baseUrl}/user_profile?user=${STUDENT_USERNAME}`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  RUN_DB_TEST('renders the seeded student profile with the institution update form', async function () {
    const sessionCookie = await loginAs(baseUrl, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })
    const response = await fetch(`${baseUrl}/user_profile?user=${STUDENT_USERNAME}`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain(`Hello, ${STUDENT_USERNAME}`)
    expect(body).toContain('Test')
    expect(body).toContain('User')
    expect(body).toContain('test@email.com')
    expect(body).toContain('Engineering and the Built Environment')
    expect(body).toContain('Electrical and Information Engineering')
    expect(body).toContain('Academic Profile')
    expect(body).toContain('Autofill Courses')
    expect(body).toContain('Save Academic Profile')
    expect(body).toContain('e.g. BSc (Eng) - Electrical Engineering')
    expect(body).toContain('Use one course per line')
    expect(body).toContain('Update Institution')
    expect(body).not.toContain('Consultation Preferences')
  })

  RUN_DB_TEST('saves academic profile details for the seeded profile owner', async function () {
    const sessionCookie = await loginAs(baseUrl, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })
    const response = await fetch(`${baseUrl}/users/${STUDENT_USERNAME}`, {
      body: encodeForm({
        courses: 'ELEN Circuit Theory\nELEN Electronics\nELEN Signals and Systems',
        degree: 'BSc (Eng) - Electrical Engineering'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      method: 'PATCH'
    })
    const data = await response.json()
    const updatedUser = await getUser(STUDENT_USERNAME)

    expect(response.status).toBe(200)
    expect(data).toEqual({
      profile: {
        courses: ['ELEN Circuit Theory', 'ELEN Electronics', 'ELEN Signals and Systems'],
        degree: 'BSc (Eng) - Electrical Engineering'
      },
      success: true
    })
    expect(updatedUser).toEqual(expect.objectContaining({
      courses: ['ELEN Circuit Theory', 'ELEN Electronics', 'ELEN Signals and Systems'],
      degree: 'BSc (Eng) - Electrical Engineering'
    }))
  })

  RUN_DB_TEST('renders the seeded lecturer profile with consultation preferences controls', async function () {
    const sessionCookie = await loginAs(baseUrl, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })
    const response = await fetch(`${baseUrl}/user_profile?user=${LECTURER_USERNAME}`, {
      headers: {
        cookie: sessionCookie
      }
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain(`Hello, ${LECTURER_USERNAME}`)
    expect(body).toContain('Chuck')
    expect(body).toContain('Norris')
    expect(body).toContain('123456@students.wits.ac.za')
    expect(body).toContain('Consultation Preferences')
    expect(body).toContain('Availability Settings')
    expect(body).toContain('Save Consultation Preferences')
  })

  RUN_DB_TEST('updates institution details for the seeded student profile owner', async function () {
    await connectToDatabase()
    await updateUserInstitutions(STUDENT_USERNAME, {
      facultyId: 'unassigned',
      schoolId: 'unassigned',
      universityId: 'unassigned'
    })

    const sessionCookie = await loginAs(baseUrl, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })
    const response = await fetch(`${baseUrl}/user_profile?user=${STUDENT_USERNAME}`, {
      body: encodeForm({
        faculty: FACULTY_NAME,
        school: SCHOOL_NAME,
        university: UNIVERSITY_NAME,
        user: STUDENT_USERNAME
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: sessionCookie
      },
      method: 'POST'
    })
    const body = await response.text()
    const updatedUser = await getUser(STUDENT_USERNAME)

    expect(response.status).toBe(200)
    expect(body).toContain(UNIVERSITY_NAME)
    expect(body).toContain(FACULTY_NAME)
    expect(body).toContain(SCHOOL_NAME)
    expect(updatedUser).toEqual(expect.objectContaining({
      facultyId: FACULTY_NAME,
      schoolId: SCHOOL_NAME,
      universityId: UNIVERSITY_NAME
    }))
  })

  RUN_DB_TEST('saves consultation preferences for the seeded lecturer profile owner', async function () {
    const sessionCookie = await loginAs(baseUrl, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })
    const response = await fetch(`${baseUrl}/user_profile?user=${LECTURER_USERNAME}`, {
      body: encodeForm({
        formType: 'consultationPreferences',
        username: LECTURER_USERNAME,
        minStudents: '1',
        maxStudents: '3',
        duration: '45',
        dailyMax: '2',
        availability_monday: 'available',
        start_time_monday: '10:00',
        end_time_monday: '11:00',
        exceptionDates: '2030-11-10\n2030-11-11'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
        cookie: sessionCookie
      },
      method: 'POST'
    })
    const data = await response.json()
    const savedPreferences = await getLecturerAvailability(LECTURER_USERNAME)

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(savedPreferences).toEqual(expect.objectContaining({
      dailyMax: 2,
      duration: 45,
      exceptionDates: ['2030-11-10', '2030-11-11'],
      maxStudents: 3,
      minStudents: 1,
      username: LECTURER_USERNAME,
      weeklyAvailability: [
        { day: 'monday', startTime: '10:00', endTime: '11:00' }
      ]
    }))
  })
})

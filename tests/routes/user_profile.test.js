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
    const response = await fetch(`${baseUrl}/user_profile?user=morris&viewer=morris`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledWith('morris')
    expect(body).toContain('Hello morris')
    expect(body).toContain('Update Institution')
    expect(body).toContain('Morris')
    expect(body).toContain('Wits')
    expect(body).toContain('sd3lovers@example.com')
    expect(body).toContain('University of the Witwatersrand')
    expect(body).toContain('Engineering and the Built Environment')
    expect(body).toContain('Electrical and Information Engineering')
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

    const response = await fetch(`${baseUrl}/user_profile?user=alice&viewer=morris`, {
      headers: {
        cookie: sessionCookie
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(getUser).toHaveBeenCalledWith('alice')
    expect(body).toContain('Hello alice')
    expect(body).not.toContain('Update Institution')
    expect(body).toContain('alice@example.com')
  })

  test('Redirects to login when the user does not exist', async () => {
    const sessionCookie = await loginAs()
    getUser.mockResolvedValueOnce(null)

    const response = await fetch(`${baseUrl}/user_profile?user=missing&viewer=morris`, {
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
        university: 'Updated University',
        viewer: 'morris'
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
        university: 'Updated University',
        viewer: 'morris'
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
        university: 'University of the Witwatersrand',
        viewer: 'morris'
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
        university: 'Updated University',
        viewer: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(403)
    expect(updateUserInstitutions).not.toHaveBeenCalled()
    expect(body).toContain('You can only edit your own profile.')
    expect(body).not.toContain('Update Institution')
  })
})

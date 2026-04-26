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
  getUser: jest.fn()
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

const { connectToDatabase } = require('../../src/models/db')
const {
  getFaculty,
  getSchool,
  getUniversity,
  isFacultyInUniversity,
  isSchoolInFaculty,
  searchFaculties,
  searchSchools,
  searchUniversities
} = require('../../src/models/university_db')
const { addUser } = require('../../src/models/user_db')
const app = require('../../src/app')

/**
 * Encodes form fields for URL-encoded POST requests.
 * @param {Record<string, string>} fields - Form fields to encode.
 * @returns {string} URL-encoded form payload.
 */
const encodeForm = function (fields) {
  return new URLSearchParams(fields).toString()
}

describe('register route', () => {
  let server
  let baseUrl

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
    connectToDatabase.mockResolvedValue(undefined)
    addUser.mockResolvedValue({ acknowledged: true, insertedId: 'new-user-id' })
    getFaculty.mockResolvedValue({ name: 'Engineering and the Built Environment' })
    getSchool.mockResolvedValue({ name: 'Electrical and Information Engineering' })
    getUniversity.mockResolvedValue({ name: 'University of the Witwatersrand' })
    isFacultyInUniversity.mockResolvedValue(true)
    isSchoolInFaculty.mockResolvedValue(true)
    searchFaculties.mockResolvedValue([
      { name: 'Engineering and the Built Environment' }
    ])
    searchSchools.mockResolvedValue([
      { name: 'Electrical and Information Engineering' }
    ])
    searchUniversities.mockResolvedValue([
      { name: 'University of the Witwatersrand' }
    ])
  })

  test('Creates a user from the Register form and redirects to login page', async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        faculty: 'Engineering and the Built Environment',
        name: 'Morris',
        password: 'welovesd3',
        role: 'student',
        school: 'Electrical and Information Engineering',
        surname: 'Wits',
        university: 'University of the Witwatersrand',
        username: 'morris'
      }),
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(addUser).toHaveBeenCalledTimes(1)
    expect(addUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'newuser@example.com',
      facultyId: 'Engineering and the Built Environment',
      firstName: 'Morris',
      lastName: 'Wits',
      role: 'student',
      schoolId: 'Electrical and Information Engineering',
      universityId: 'University of the Witwatersrand',
      username: 'morris'
    }))
    expect(getFaculty).toHaveBeenCalledWith('Engineering and the Built Environment')
    expect(getSchool).toHaveBeenCalledWith('Electrical and Information Engineering')
    expect(getUniversity).toHaveBeenCalledWith('University of the Witwatersrand')
    expect(isFacultyInUniversity).toHaveBeenCalled()
    expect(isSchoolInFaculty).toHaveBeenCalled()

    const insertedUser = addUser.mock.calls[0][0]
    expect(insertedUser.passwordHash).toContain(':')
    expect(insertedUser.passwordHash).not.toBe('welovesd3')
  })

  test('Re-renders the Register page when the university is not from the database list', async () => {
    getUniversity.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        faculty: 'Engineering and the Built Environment',
        name: 'Morris',
        password: 'welovesd3',
        role: 'student',
        school: 'Electrical and Information Engineering',
        surname: 'Wits',
        university: 'Unknown University',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Choose a university from the database list.')
  })

  test('Re-renders the Register page when the faculty is not from the database list', async () => {
    getFaculty.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        faculty: 'Unknown Faculty',
        name: 'Morris',
        password: 'welovesd3',
        role: 'student',
        school: 'Electrical and Information Engineering',
        surname: 'Wits',
        university: 'University of the Witwatersrand',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Choose a faculty from the database list.')
  })

  test('Re-renders the Register page when the faculty does not belong to the selected university', async () => {
    isFacultyInUniversity.mockResolvedValue(false)

    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        faculty: 'Engineering and the Built Environment',
        name: 'Morris',
        password: 'welovesd3',
        role: 'student',
        school: 'Electrical and Information Engineering',
        surname: 'Wits',
        university: 'University of the Witwatersrand',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Choose a faculty that belongs to the selected university.')
  })

  test('Re-renders the Register page when the school is not from the database list', async () => {
    getSchool.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        faculty: 'Engineering and the Built Environment',
        name: 'Morris',
        password: 'welovesd3',
        role: 'student',
        school: 'Unknown School',
        surname: 'Wits',
        university: 'University of the Witwatersrand',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Choose a school from the database list.')
  })

  test('Re-renders the Register page when the school does not belong to the selected faculty', async () => {
    isSchoolInFaculty.mockResolvedValue(false)

    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        faculty: 'Engineering and the Built Environment',
        name: 'Morris',
        password: 'welovesd3',
        role: 'student',
        school: 'Electrical and Information Engineering',
        surname: 'Wits',
        university: 'University of the Witwatersrand',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Choose a school that belongs to the selected faculty.')
  })

  test('Re-renders the Register page when required fields are missing', async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: '',
        faculty: '',
        name: '',
        password: '',
        role: '',
        school: '',
        surname: '',
        university: '',
        username: ''
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Username, password, first/last names and institution credentials are required.')
  })

  test('Re-renders the Register page when the email address format is invalid', async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'not-an-email',
        faculty: 'Engineering and the Built Environment',
        name: 'Morris',
        password: 'welovesd3',
        role: 'student',
        school: 'Electrical and Information Engineering',
        surname: 'Wits',
        university: 'University of the Witwatersrand',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(400)
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(addUser).not.toHaveBeenCalled()
    expect(body).toContain('Enter a valid email address.')
  })

  test('Re-renders the Register page when the username already exists', async () => {
    addUser.mockRejectedValue({ code: 11000 })

    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: encodeForm({
        emailAddress: 'newUser@example.com',
        faculty: 'Engineering and the Built Environment',
        name: 'Morris',
        password: 'welovesd3',
        role: 'student',
        school: 'Electrical and Information Engineering',
        surname: 'Wits',
        university: 'University of the Witwatersrand',
        username: 'morris'
      })
    })

    const body = await response.text()

    expect(response.status).toBe(409)
    expect(body).toContain('That username is already taken.')
  })
})

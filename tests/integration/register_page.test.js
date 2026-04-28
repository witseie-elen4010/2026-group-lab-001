const http = require('node:http')
const { closeDatabaseConnection, connectToDatabase } = require('../../src/models/db')
const { deleteUser, getUser } = require('../../src/models/user_db')
const app = require('../../src/app')

const FACULTY_NAME = 'Engineering and the Built Environment'
const PASSWORD = 'SD3andIareBFFs'
const SCHOOL_NAME = 'Electrical and Information Engineering'
const UNIVERSITY_NAME = 'University of the Witwatersrand'
const RUN_DB_TABLE_TEST = process.env.MONGODB_URI ? test.each : test.skip.each
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

describe('register page integration flow', () => {
  let baseUrl
  let createdUsername = ''
  let server

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

  afterAll(async function () {
    if (!process.env.MONGODB_URI) {
      return
    }

    if (createdUsername) {
      await connectToDatabase()
      await deleteUser(createdUsername)
    }

    await closeServer(server)
    await closeDatabaseConnection()
  })

  RUN_DB_TEST('renders the register page with the institution search inputs', async function () {
    const response = await fetch(`${baseUrl}/register`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<title>Register</title>')
    expect(body).toContain('/scripts/search.js')
    expect(body).toContain('data-search-url="/institutions/universities"')
    expect(body).toContain('data-search-url="/institutions/faculties"')
    expect(body).toContain('data-search-url="/institutions/schools"')
  })

  RUN_DB_TEST('creates a student user and redirects to the login page', async function () {
    const username = `register_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const emailAddress = `${username}@Students.Wits.Ac.Za`
    createdUsername = username

    const registerResponse = await fetch(`${baseUrl}/register`, {
      body: encodeForm({
        emailAddress,
        faculty: FACULTY_NAME,
        name: 'Integration',
        password: PASSWORD,
        role: 'student',
        school: SCHOOL_NAME,
        surname: 'Register',
        university: UNIVERSITY_NAME,
        username
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      redirect: 'manual'
    })

    expect(registerResponse.status).toBe(302)
    expect(registerResponse.headers.get('location')).toBe('/login')

    await connectToDatabase()
    const createdUser = await getUser(username)

    expect(createdUser).toEqual(expect.objectContaining({
      email: emailAddress.toLowerCase(),
      facultyId: FACULTY_NAME,
      firstName: 'Integration',
      lastName: 'Register',
      role: 'student',
      schoolId: SCHOOL_NAME,
      universityId: UNIVERSITY_NAME,
      username
    }))
    expect(createdUser.passwordHash).toContain(':')
    expect(createdUser.passwordHash).not.toBe(PASSWORD)

    await deleteUser(username)
    createdUsername = ''
  })

  RUN_DB_TEST('re-renders the register page when the username is already taken', async function () {
    const response = await fetch(`${baseUrl}/register`, {
      body: encodeForm({
        emailAddress: 'duplicate-user@students.wits.ac.za',
        faculty: FACULTY_NAME,
        name: 'Duplicate',
        password: PASSWORD,
        role: 'student',
        school: SCHOOL_NAME,
        surname: 'User',
        university: UNIVERSITY_NAME,
        username: 'user'
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.text()

    expect(response.status).toBe(409)
    expect(body).toContain('That username is already taken.')
    expect(body).toContain('<title>Register</title>')
  })

  RUN_DB_TABLE_TEST([
    {
      errorMessage: 'Choose a university from the database list.',
      fieldName: 'university',
      invalidValue: 'Invalid University'
    },
    {
      errorMessage: 'Choose a faculty from the database list.',
      fieldName: 'faculty',
      invalidValue: 'Invalid Faculty'
    },
    {
      errorMessage: 'Choose a school from the database list.',
      fieldName: 'school',
      invalidValue: 'Invalid School'
    }
  ])('re-renders the register page for an invalid $fieldName selection', async function ({ errorMessage, fieldName, invalidValue }) {
    const response = await fetch(`${baseUrl}/register`, {
      body: encodeForm({
        emailAddress: 'invalid-selection@students.wits.ac.za',
        faculty: fieldName === 'faculty' ? invalidValue : FACULTY_NAME,
        name: 'Invalid',
        password: PASSWORD,
        role: 'student',
        school: fieldName === 'school' ? invalidValue : SCHOOL_NAME,
        surname: 'Selection',
        university: fieldName === 'university' ? invalidValue : UNIVERSITY_NAME,
        username: `invalid_${fieldName}`
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    })
    const body = await response.text()

    expect(response.status).toBe(400)
    expect(body).toContain(errorMessage)
    expect(body).toContain('<title>Register</title>')
  })
})

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

const { connectToDatabase } = require('../../src/models/db')
const {
  searchFaculties,
  searchSchools,
  searchUniversities
} = require('../../src/models/university_db')
const app = require('../../src/app')

describe('institution search route', () => {
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

  beforeEach(() => {
    jest.clearAllMocks()
    connectToDatabase.mockResolvedValue(undefined)
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

  test('Returns matching universities for the shared search endpoint', async () => {
    const response = await fetch(`${baseUrl}/institutions/universities?query=wit`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      results: ['University of the Witwatersrand']
    })
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(searchUniversities).toHaveBeenCalledWith('wit', 8)
  })

  test('Returns no universities when the shared search query is blank', async () => {
    const response = await fetch(`${baseUrl}/institutions/universities?query=%20%20`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ results: [] })
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(searchUniversities).not.toHaveBeenCalled()
  })

  test('Returns a server error when university search fails', async () => {
    searchUniversities.mockRejectedValue(new Error('search failed'))

    const response = await fetch(`${baseUrl}/institutions/universities?query=wit`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Sorry. We can not search universities right now.',
      results: []
    })
  })

  test('Returns matching faculties for the shared search endpoint', async () => {
    const response = await fetch(`${baseUrl}/institutions/faculties?query=eng&university=University%20of%20the%20Witwatersrand`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      results: ['Engineering and the Built Environment']
    })
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(searchFaculties).toHaveBeenCalledWith('eng', {
      limit: 8,
      university: 'University of the Witwatersrand'
    })
  })

  test('Returns no faculties when the shared search query is blank', async () => {
    const response = await fetch(`${baseUrl}/institutions/faculties?query=%20%20&university=University%20of%20the%20Witwatersrand`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ results: [] })
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(searchFaculties).not.toHaveBeenCalled()
  })

  test('Returns a server error when faculty search fails', async () => {
    searchFaculties.mockRejectedValue(new Error('search failed'))

    const response = await fetch(`${baseUrl}/institutions/faculties?query=eng&university=University%20of%20the%20Witwatersrand`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Sorry. We can not search faculties right now.',
      results: []
    })
  })

  test('Returns matching schools for the shared search endpoint', async () => {
    const response = await fetch(`${baseUrl}/institutions/schools?query=elect&university=University%20of%20the%20Witwatersrand&faculty=Engineering%20and%20the%20Built%20Environment`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      results: ['Electrical and Information Engineering']
    })
    expect(connectToDatabase).toHaveBeenCalledTimes(1)
    expect(searchSchools).toHaveBeenCalledWith('elect', {
      faculty: 'Engineering and the Built Environment',
      limit: 8,
      university: 'University of the Witwatersrand'
    })
  })

  test('Returns no schools when the shared search query is blank', async () => {
    const response = await fetch(`${baseUrl}/institutions/schools?query=%20%20&university=University%20of%20the%20Witwatersrand&faculty=Engineering%20and%20the%20Built%20Environment`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ results: [] })
    expect(connectToDatabase).not.toHaveBeenCalled()
    expect(searchSchools).not.toHaveBeenCalled()
  })

  test('Returns a server error when school search fails', async () => {
    searchSchools.mockRejectedValue(new Error('search failed'))

    const response = await fetch(`${baseUrl}/institutions/schools?query=elect&university=University%20of%20the%20Witwatersrand&faculty=Engineering%20and%20the%20Built%20Environment`, {
      headers: {
        accept: 'application/json'
      }
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Sorry. We could not search schools right now.',
      results: []
    })
  })
})

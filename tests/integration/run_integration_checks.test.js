jest.mock('../../src/models/db', () => ({
  closeDatabaseConnection: jest.fn(),
  connectToDatabase: jest.fn()
}))

jest.mock('../../src/models/lecturer_availability_db', () => ({
  getLecturerAvailability: jest.fn(),
  setLecturerAvailability: jest.fn()
}))

const ORIGINAL_ENV = process.env

const { closeDatabaseConnection, connectToDatabase } = require('../../src/models/db')
const { getLecturerAvailability, setLecturerAvailability } = require('../../src/models/lecturer_availability_db')
const { run } = require('../../src/integration/run_integration_checks')

describe('integration availability checks', () => {
  let consoleErrorSpy
  let consoleLogSpy

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.INTEG_TEST_USER
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    closeDatabaseConnection.mockResolvedValue(undefined)
    connectToDatabase.mockResolvedValue(undefined)
    getLecturerAvailability.mockResolvedValue({ minStudents: 1 })
    setLecturerAvailability.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  test('returns success when the fetched availability matches the saved data', async () => {
    await expect(run()).resolves.toBe(0)

    expect(setLecturerAvailability).toHaveBeenCalledWith('integration_test_lecturer', {
      minStudents: 1,
      maxStudents: 3,
      duration: 30,
      dailyMax: 6,
      weeklyAvailability: [
        { day: 'monday', startTime: '09:00', endTime: '17:00' }
      ],
      exceptionDates: []
    })
    expect(getLecturerAvailability).toHaveBeenCalledWith('integration_test_lecturer')
    expect(consoleLogSpy).toHaveBeenCalledWith('Integration check passed')
    expect(closeDatabaseConnection).toHaveBeenCalledTimes(1)
  })

  test('uses the configured integration test user and returns mismatch failures', async () => {
    process.env.INTEG_TEST_USER = 'alice'
    getLecturerAvailability.mockResolvedValue({ minStudents: 99 })

    await expect(run()).resolves.toBe(2)

    expect(setLecturerAvailability).toHaveBeenCalledWith('alice', expect.any(Object))
    expect(getLecturerAvailability).toHaveBeenCalledWith('alice')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Integration check failed: fetched data mismatch')
    expect(closeDatabaseConnection).toHaveBeenCalledTimes(1)
  })

  test('returns an error code when the integration check throws', async () => {
    connectToDatabase.mockRejectedValue(new Error('database unavailable'))

    await expect(run()).resolves.toBe(1)

    expect(consoleErrorSpy).toHaveBeenCalledWith('Integration check error:', 'database unavailable')
    expect(closeDatabaseConnection).toHaveBeenCalledTimes(1)
  })
})

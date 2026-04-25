jest.mock('../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { getCollection } = require('../../src/models/db')
const { getLecturerAvailability, setLecturerAvailability } = require('../../src/models/lecturer_availability_db')

describe('lecturer availability database operations', () => {
  let mockCollection

  beforeEach(() => {
    jest.clearAllMocks()
    mockCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn()
    }
    getCollection.mockResolvedValue(mockCollection)
  })

  test('getLecturerAvailability queries the LecturerAvailability collection by username', async () => {
    const preferences = { username: 'dr_jones', minStudents: 2, maxStudents: 10, duration: 60, dailyMax: 4 }
    mockCollection.findOne.mockResolvedValue(preferences)

    const result = await getLecturerAvailability('dr_jones')

    expect(getCollection).toHaveBeenCalledWith('LecturerAvailability')
    expect(mockCollection.findOne).toHaveBeenCalledWith({ username: 'dr_jones' })
    expect(result).toEqual(preferences)
  })

  test('getLecturerAvailability returns null when no preferences are set', async () => {
    mockCollection.findOne.mockResolvedValue(null)

    const result = await getLecturerAvailability('dr_jones')

    expect(result).toBeNull()
  })

  test('setLecturerAvailability upserts the preferences document for the given username', async () => {
    mockCollection.updateOne.mockResolvedValue({ acknowledged: true })

    await setLecturerAvailability('dr_jones', { minStudents: 2, maxStudents: 10, duration: 60, dailyMax: 4 })

    expect(getCollection).toHaveBeenCalledWith('LecturerAvailability')
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { username: 'dr_jones' },
      { $set: { username: 'dr_jones', minStudents: 2, maxStudents: 10, duration: 60, dailyMax: 4 } },
      { upsert: true }
    )
  })

  test('setLecturerAvailability upserts weekly availability and exception dates when provided', async function () {
    mockCollection.updateOne.mockResolvedValue({ acknowledged: true })

    await setLecturerAvailability('dr_jones', {
      weeklyAvailability: [
        { day: 'monday', startTime: '09:00', endTime: '12:00' },
        { day: 'wednesday', startTime: '13:00', endTime: '16:00' }
      ],
      exceptionDates: ['2026-05-01', '2026-05-08']
    })

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { username: 'dr_jones' },
      {
        $set: {
          username: 'dr_jones',
          weeklyAvailability: [
            { day: 'monday', startTime: '09:00', endTime: '12:00' },
            { day: 'wednesday', startTime: '13:00', endTime: '16:00' }
          ],
          exceptionDates: ['2026-05-01', '2026-05-08']
        }
      },
      { upsert: true }
    )
  })

  test('setLecturerAvailability only sets the fields that are provided', async function () {
    mockCollection.updateOne.mockResolvedValue({ acknowledged: true })

    await setLecturerAvailability('dr_jones', {
      duration: 45,
      weeklyAvailability: [{ day: 'friday', startTime: '10:00', endTime: '11:00' }]
    })

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { username: 'dr_jones' },
      {
        $set: {
          username: 'dr_jones',
          duration: 45,
          weeklyAvailability: [{ day: 'friday', startTime: '10:00', endTime: '11:00' }]
        }
      },
      { upsert: true }
    )
  })
})

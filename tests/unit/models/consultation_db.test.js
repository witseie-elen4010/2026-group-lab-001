jest.mock('../../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { getCollection } = require('../../../src/models/db')
const { addConsultation, listConsultationsForLecturerOnDate } = require('../../../src/models/consultation_db')

describe('consultation database operations', () => {
  let mockCollection

  beforeEach(() => {
    jest.clearAllMocks()
    mockCollection = {
      find: jest.fn(),
      insertOne: jest.fn()
    }
    getCollection.mockReturnValue(mockCollection)
  })

  test('addConsultation inserts a document into the Consultation collection', async () => {
    const consultation = {
      attendees: ['morris'],
      capacity: 1,
      datetime: '2026-05-04T09:00',
      lecturerId: 'lecturer1',
      organiserId: 'morris',
      title: 'Project check-in'
    }
    const insertResult = { acknowledged: true, insertedId: 'consultation-id' }
    mockCollection.insertOne.mockResolvedValue(insertResult)

    const result = await addConsultation(consultation)

    expect(getCollection).toHaveBeenCalledWith('Consultation')
    expect(mockCollection.insertOne).toHaveBeenCalledWith(consultation)
    expect(result).toEqual(insertResult)
  })

  test('listConsultationsForLecturerOnDate returns the lecturer bookings for that date', async () => {
    const toArray = jest.fn().mockResolvedValue([{ title: 'Project check-in' }])
    mockCollection.find.mockReturnValue({ toArray })

    const result = await listConsultationsForLecturerOnDate('lecturer1', '2026-05-04')

    expect(getCollection).toHaveBeenCalledWith('Consultation')
    expect(mockCollection.find).toHaveBeenCalledWith({
      lecturerId: 'lecturer1',
      datetime: {
        $gte: '2026-05-04T00:00',
        $lt: '2026-05-04T23:59~'
      }
    })
    expect(toArray).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ title: 'Project check-in' }])
  })
})

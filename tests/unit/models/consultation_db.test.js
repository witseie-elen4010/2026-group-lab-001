jest.mock('../../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { getCollection } = require('../../../src/models/db')
const { addConsultation } = require('../../../src/models/consultation_db')

describe('consultation database operations', () => {
  let mockCollection

  beforeEach(() => {
    jest.clearAllMocks()
    mockCollection = {
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
})

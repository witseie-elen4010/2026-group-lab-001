jest.mock('../../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { ObjectId } = require('mongodb')
const { getCollection } = require('../../../src/models/db')
const {
  addConsultation,
  addStudentToConsultation,
  JOIN_RESULT_REASONS,
  listConsultationsForLecturerOnDate
} = require('../../../src/models/consultation_db')

describe('consultation database operations', () => {
  let mockConsultationCollection

  beforeEach(() => {
    jest.clearAllMocks()
    mockConsultationCollection = {
      find: jest.fn(),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn()
    }
    getCollection.mockImplementation(function (name) {
      if (name === 'Consultation') {
        return mockConsultationCollection
      }

      return null
    })
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
    mockConsultationCollection.insertOne.mockResolvedValue(insertResult)

    const result = await addConsultation(consultation)

    expect(getCollection).toHaveBeenCalledWith('Consultation')
    expect(mockConsultationCollection.insertOne).toHaveBeenCalledWith(consultation)
    expect(result).toEqual(insertResult)
  })

  test('listConsultationsForLecturerOnDate returns the lecturer bookings for that date', async () => {
    const toArray = jest.fn().mockResolvedValue([{ title: 'Project check-in' }])
    mockConsultationCollection.find.mockReturnValue({ toArray })

    const result = await listConsultationsForLecturerOnDate('lecturer1', '2026-05-04')

    expect(getCollection).toHaveBeenCalledWith('Consultation')
    expect(mockConsultationCollection.find).toHaveBeenCalledWith({
      lecturerId: 'lecturer1',
      datetime: {
        $gte: '2026-05-04T00:00',
        $lt: '2026-05-04T23:59~'
      }
    })
    expect(toArray).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ title: 'Project check-in' }])
  })

  test('addStudentToConsultation appends a student when the consultation is open', async () => {
    const consultationId = new ObjectId()
    mockConsultationCollection.findOne.mockResolvedValue({
      _id: consultationId,
      attendees: ['organiser1'],
      capacity: 2
    })
    mockConsultationCollection.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })

    const result = await addStudentToConsultation(consultationId.toString(), 'student1')

    expect(mockConsultationCollection.findOne).toHaveBeenCalledWith({ _id: consultationId })
    expect(mockConsultationCollection.updateOne).toHaveBeenCalledWith(
      { _id: consultationId },
      { $addToSet: { attendees: 'student1' } }
    )
    expect(result).toEqual({ success: true })
  })

  test('addStudentToConsultation rejects joining a full consultation', async () => {
    const consultationId = new ObjectId()
    mockConsultationCollection.findOne.mockResolvedValue({
      _id: consultationId,
      attendees: ['organiser1'],
      capacity: 1
    })

    const result = await addStudentToConsultation(consultationId.toString(), 'student1')

    expect(mockConsultationCollection.updateOne).not.toHaveBeenCalled()
    expect(result).toEqual({
      reason: JOIN_RESULT_REASONS.FULL,
      statusCode: 400,
      success: false
    })
  })
})

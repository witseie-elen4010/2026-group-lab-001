jest.mock('../../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { ObjectId } = require('mongodb')
const { getCollection } = require('../../../src/models/db')
const {
  addConsultation,
  addStudentToConsultation,
  getConsultationsForCalendar,
  JOIN_RESULT_REASONS,
  listConsultationsForLecturerOnDate,
  searchConsultationsForStudent
} = require('../../../src/models/consultation_db')

describe('consultation database operations', () => {
  let mockConsultationCollection
  let mockUserCollection
  let mockLecturerAvailabilityCollection

  beforeEach(() => {
    jest.clearAllMocks()
    mockConsultationCollection = {
      find: jest.fn(),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn()
    }
    mockUserCollection = {
      find: jest.fn()
    }
    mockLecturerAvailabilityCollection = {
      find: jest.fn()
    }
    getCollection.mockImplementation(function (name) {
      if (name === 'Consultation') {
        return mockConsultationCollection
      }

      if (name === 'User') {
        return mockUserCollection
      }

      if (name === 'LecturerAvailability') {
        return mockLecturerAvailabilityCollection
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

  test('searchConsultationsForStudent queries all consultations when no filters are given', async () => {
    const toArray = jest.fn().mockResolvedValue([])
    mockConsultationCollection.find.mockReturnValue({ toArray })

    await searchConsultationsForStudent({ username: 'student1' })

    expect(mockConsultationCollection.find).toHaveBeenCalledWith({})
  })

  test('searchConsultationsForStudent filters by lecturerId when provided', async () => {
    const toArray = jest.fn().mockResolvedValue([])
    mockConsultationCollection.find.mockReturnValue({ toArray })

    await searchConsultationsForStudent({ username: 'student1', lecturerId: 'lecturer1' })

    expect(mockConsultationCollection.find).toHaveBeenCalledWith({ lecturerId: 'lecturer1' })
  })

  test('searchConsultationsForStudent filters by date range when only date is provided', async () => {
    const toArray = jest.fn().mockResolvedValue([])
    mockConsultationCollection.find.mockReturnValue({ toArray })

    await searchConsultationsForStudent({ username: 'student1', date: '2026-05-04' })

    expect(mockConsultationCollection.find).toHaveBeenCalledWith({
      datetime: { $gte: '2026-05-04T00:00', $lt: '2026-05-04T23:59~' }
    })
  })

  test('searchConsultationsForStudent filters by exact datetime when date and time are both provided', async () => {
    const toArray = jest.fn().mockResolvedValue([])
    mockConsultationCollection.find.mockReturnValue({ toArray })

    await searchConsultationsForStudent({ username: 'student1', date: '2026-05-04', time: '09:00' })

    expect(mockConsultationCollection.find).toHaveBeenCalledWith({ datetime: '2026-05-04T09:00' })
  })

  describe('getConsultationsForCalendar', () => {
    const MONTH_START = '2030-06-01T00:00'
    const MONTH_END = '2030-06-30T23:59~'
    const FUTURE_DATE = '2030-06-15T10:00'

    const setupMocks = function ({ consultations, users = [], availabilities = [] }) {
      mockConsultationCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue(consultations) })
      mockUserCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue(users) })
      mockLecturerAvailabilityCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue(availabilities) })
    }

    test('queries the Consultation collection by month range', async () => {
      setupMocks({ consultations: [] })

      await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(mockConsultationCollection.find).toHaveBeenCalledWith({
        datetime: { $gte: MONTH_START, $lt: MONTH_END }
      })
    })

    test('returns an empty array when no consultations exist in the month', async () => {
      setupMocks({ consultations: [] })

      const result = await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(result).toEqual([])
    })

    test('excludes past consultations', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      setupMocks({
        consultations: [{ _id: new ObjectId(), attendees: [], capacity: 1, datetime: pastDate, lecturerId: 'lecturer1', title: 'Past' }],
        users: [],
        availabilities: []
      })

      const result = await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(result).toHaveLength(0)
    })

    test('sets hasJoined to true when the student is an attendee', async () => {
      setupMocks({
        consultations: [{ _id: new ObjectId(), attendees: ['student1'], capacity: 2, datetime: FUTURE_DATE, lecturerId: 'lecturer1', title: 'DS Review' }],
        users: [{ username: 'lecturer1', firstName: 'Jane', lastName: 'Doe' }],
        availabilities: [{ username: 'lecturer1', duration: 60 }]
      })

      const result = await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(result[0].hasJoined).toBe(true)
    })

    test('sets hasJoined to false when the student is not an attendee', async () => {
      setupMocks({
        consultations: [{ _id: new ObjectId(), attendees: ['otherStudent'], capacity: 2, datetime: FUTURE_DATE, lecturerId: 'lecturer1', title: 'DS Review' }],
        users: [],
        availabilities: []
      })

      const result = await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(result[0].hasJoined).toBe(false)
    })

    test('sets isFull to true when attendees equals capacity', async () => {
      setupMocks({
        consultations: [{ _id: new ObjectId(), attendees: ['otherStudent'], capacity: 1, datetime: FUTURE_DATE, lecturerId: 'lecturer1', title: 'Full' }],
        users: [],
        availabilities: []
      })

      const result = await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(result[0].isFull).toBe(true)
    })

    test('sets isFull to false when there is remaining capacity', async () => {
      setupMocks({
        consultations: [{ _id: new ObjectId(), attendees: [], capacity: 2, datetime: FUTURE_DATE, lecturerId: 'lecturer1', title: 'Available' }],
        users: [],
        availabilities: []
      })

      const result = await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(result[0].isFull).toBe(false)
    })

    test('builds the lecturer display name from the user document', async () => {
      setupMocks({
        consultations: [{ _id: new ObjectId(), attendees: [], capacity: 1, datetime: FUTURE_DATE, lecturerId: 'lecturer1', title: 'DS Review' }],
        users: [{ username: 'lecturer1', firstName: 'Jane', lastName: 'Doe' }],
        availabilities: []
      })

      const result = await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(result[0].lecturer).toBe('Jane Doe')
    })

    test('computes the end time from the start time and lecturer duration', async () => {
      setupMocks({
        consultations: [{ _id: new ObjectId(), attendees: [], capacity: 1, datetime: FUTURE_DATE, lecturerId: 'lecturer1', title: 'DS Review' }],
        users: [],
        availabilities: [{ username: 'lecturer1', duration: 60 }]
      })

      const result = await getConsultationsForCalendar('student1', MONTH_START, MONTH_END)

      expect(result[0].time).toBe('10:00 to 11:00')
    })
  })

  test('searchConsultationsForStudent only returns consultations in the future', async () => {
    const now = new Date()
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)

    const futureId = new ObjectId()
    const pastId = new ObjectId()

    const consultationsToArray = jest.fn().mockResolvedValue([
      {
        _id: pastId,
        attendees: [],
        capacity: 1,
        datetime: pastDate,
        lecturerId: 'lecturer1',
        organiserId: 'organiser1',
        title: 'Past consultation'
      },
      {
        _id: futureId,
        attendees: [],
        capacity: 1,
        datetime: futureDate,
        lecturerId: 'lecturer1',
        organiserId: 'organiser1',
        title: 'Future consultation'
      }
    ])

    const usersToArray = jest.fn().mockResolvedValue([
      { firstName: 'Lec', lastName: 'Turer', username: 'lecturer1' },
      { firstName: 'Org', lastName: 'Aniser', username: 'organiser1' }
    ])

    const availabilityToArray = jest.fn().mockResolvedValue([
      { duration: 30, username: 'lecturer1' }
    ])

    mockConsultationCollection.find.mockReturnValue({ toArray: consultationsToArray })
    mockUserCollection.find.mockReturnValue({ toArray: usersToArray })
    mockLecturerAvailabilityCollection.find.mockReturnValue({ toArray: availabilityToArray })

    const result = await searchConsultationsForStudent({ username: 'student1' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      canJoin: true,
      id: futureId.toString(),
      name: 'Future consultation'
    })
    expect(result.some(function (consultation) {
      return consultation.id === pastId.toString()
    })).toBe(false)
  })
})

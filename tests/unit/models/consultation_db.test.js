jest.mock('../../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { ObjectId } = require('mongodb')
const { getCollection } = require('../../../src/models/db')
const {
  addConsultation,
  addStudentToConsultation,
  cancelConsultation,
  CANCEL_RESULT_REASONS,
  getConsultationsForCalendar,
  getConsultationsForStudent,
  getUpcomingConsultationsForFollowedLecturers,
  getUpcomingConsultationsForLecturer,
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
      deleteOne: jest.fn(),
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
      datetime: '2030-05-04T09:00',
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

    const result = await listConsultationsForLecturerOnDate('lecturer1', '2030-05-04')

    expect(getCollection).toHaveBeenCalledWith('Consultation')
    expect(mockConsultationCollection.find).toHaveBeenCalledWith({
      lecturerId: 'lecturer1',
      datetime: {
        $gte: '2030-05-04T00:00',
        $lt: '2030-05-04T23:59~'
      }
    })
    expect(toArray).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ title: 'Project check-in' }])
  })

  test('getUpcomingConsultationsForLecturer returns upcoming dashboard consultations for the lecturer', async () => {
    const buildDatetime = function (dayOffset, hours, minutes) {
      const date = new Date()

      date.setDate(date.getDate() + dayOffset)
      date.setHours(hours, minutes, 0, 0)

      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    const futureDate = buildDatetime(1, 9, 0)
    const laterFutureDate = buildDatetime(2, 11, 30)
    const pastDate = buildDatetime(-1, 8, 0)
    const firstId = new ObjectId()
    const secondId = new ObjectId()

    mockConsultationCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        {
          _id: secondId,
          attendees: ['student4'],
          datetime: laterFutureDate,
          lecturerId: 'lecturer1',
          organiserId: 'student2',
          title: 'Later consultation'
        },
        {
          _id: firstId,
          attendees: ['student1', 'student3'],
          datetime: futureDate,
          lecturerId: 'lecturer1',
          organiserId: 'student1',
          title: 'Earlier consultation'
        },
        {
          _id: new ObjectId(),
          attendees: ['student5'],
          datetime: pastDate,
          lecturerId: 'lecturer1',
          organiserId: 'student3',
          title: 'Past consultation'
        }
      ])
    })
    mockUserCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { username: 'student1', firstName: 'Morris', lastName: 'Molefe' },
        { username: 'student3', firstName: 'Sam', lastName: 'Nkosi' }
      ])
    })
    mockLecturerAvailabilityCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { username: 'lecturer1', duration: 30 }
      ])
    })

    const result = await getUpcomingConsultationsForLecturer('lecturer1')

    expect(mockConsultationCollection.find).toHaveBeenCalledWith({ lecturerId: 'lecturer1' })
    expect(mockUserCollection.find).toHaveBeenCalledWith({
      username: {
        $in: expect.arrayContaining(['student1', 'student2', 'student3', 'student4', 'student5'])
      }
    })
    expect(result).toEqual([
      {
        date: futureDate.slice(0, 10),
        id: firstId.toString(),
        name: 'Earlier consultation',
        organiser: 'Morris Molefe',
        roster: ['Morris Molefe', 'Sam Nkosi'],
        time: '09:00 to 09:30'
      },
      {
        date: laterFutureDate.slice(0, 10),
        id: secondId.toString(),
        name: 'Later consultation',
        organiser: 'student2',
        roster: ['student4'],
        time: '11:30 to 12:00'
      }
    ])
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

    await searchConsultationsForStudent({ username: 'student1', date: '2030-05-04' })

    expect(mockConsultationCollection.find).toHaveBeenCalledWith({
      datetime: { $gte: '2030-05-04T00:00', $lt: '2030-05-04T23:59~' }
    })
  })

  test('searchConsultationsForStudent filters by exact datetime when date and time are both provided', async () => {
    const toArray = jest.fn().mockResolvedValue([])
    mockConsultationCollection.find.mockReturnValue({ toArray })

    await searchConsultationsForStudent({ username: 'student1', date: '2030-05-04', time: '09:00' })

    expect(mockConsultationCollection.find).toHaveBeenCalledWith({ datetime: '2030-05-04T09:00' })
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

  describe('getConsultationsForStudent', () => {
    test('returns an empty array when the student has no consultations', async () => {
      mockConsultationCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })

      const result = await getConsultationsForStudent('student1')

      expect(result).toEqual([])
    })

    test('returns only future consultations', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      const futureId = new ObjectId()

      mockConsultationCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { _id: futureId, attendees: ['student1'], datetime: futureDate, lecturerId: 'lecturer1', organiserId: 'student1', title: 'Future' },
          { _id: new ObjectId(), attendees: ['student1'], datetime: pastDate, lecturerId: 'lecturer1', organiserId: 'student1', title: 'Past' }
        ])
      })
      mockUserCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })
      mockLecturerAvailabilityCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })

      const result = await getConsultationsForStudent('student1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(futureId.toString())
    })

    test('sets isOrganiser to true when the student is the organiser', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)

      mockConsultationCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { _id: new ObjectId(), attendees: ['student1'], datetime: futureDate, lecturerId: 'lecturer1', organiserId: 'student1', title: 'My consultation' }
        ])
      })
      mockUserCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })
      mockLecturerAvailabilityCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })

      const result = await getConsultationsForStudent('student1')

      expect(result[0].isOrganiser).toBe(true)
    })

    test('sets isOrganiser to false when the student joined but did not organise', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)

      mockConsultationCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { _id: new ObjectId(), attendees: ['student1'], datetime: futureDate, lecturerId: 'lecturer1', organiserId: 'student2', title: 'Someone elses consultation' }
        ])
      })
      mockUserCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })
      mockLecturerAvailabilityCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })

      const result = await getConsultationsForStudent('student1')

      expect(result[0].isOrganiser).toBe(false)
    })

    test('builds the lecturer display name from the user document', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)

      mockConsultationCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { _id: new ObjectId(), attendees: ['student1'], datetime: futureDate, lecturerId: 'lecturer1', organiserId: 'student1', title: 'DS Review' }
        ])
      })
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ username: 'lecturer1', firstName: 'Jane', lastName: 'Doe' }])
      })
      mockLecturerAvailabilityCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })

      const result = await getConsultationsForStudent('student1')

      expect(result[0].lecturer).toBe('Jane Doe')
    })

    test('returns consultations sorted by datetime ascending', async () => {
      const firstDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      const secondDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16)
      const firstId = new ObjectId()
      const secondId = new ObjectId()

      mockConsultationCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { _id: secondId, attendees: ['student1'], datetime: secondDate, lecturerId: 'lecturer1', organiserId: 'student1', title: 'Later' },
          { _id: firstId, attendees: ['student1'], datetime: firstDate, lecturerId: 'lecturer1', organiserId: 'student1', title: 'Earlier' }
        ])
      })
      mockUserCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })
      mockLecturerAvailabilityCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })

      const result = await getConsultationsForStudent('student1')

      expect(result[0].id).toBe(firstId.toString())
      expect(result[1].id).toBe(secondId.toString())
    })
  })

  describe('getUpcomingConsultationsForFollowedLecturers', () => {
    test('returns an empty array when no followed lecturers are supplied', async () => {
      const result = await getUpcomingConsultationsForFollowedLecturers('student1', [])

      expect(result).toEqual([])
      expect(mockConsultationCollection.find).not.toHaveBeenCalled()
    })

    test('returns upcoming consultations for followed lecturers with dashboard details', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2030-05-01T08:00:00'))

      const buildDatetime = function (dayOffset, hours, minutes) {
        const date = new Date()

        date.setDate(date.getDate() + dayOffset)
        date.setHours(hours, minutes, 0, 0)

        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      }

      const firstDatetime = buildDatetime(1, 9, 0)
      const secondDatetime = buildDatetime(2, 11, 30)
      const firstId = new ObjectId()
      const secondId = new ObjectId()

      mockConsultationCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            _id: secondId,
            attendees: ['student2'],
            capacity: 1,
            datetime: secondDatetime,
            lecturerId: 'lecturer2',
            title: 'Later consultation'
          },
          {
            _id: firstId,
            attendees: ['student1'],
            capacity: 2,
            datetime: firstDatetime,
            lecturerId: 'lecturer1',
            title: 'Earlier consultation'
          }
        ])
      })
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { username: 'lecturer1', firstName: 'Alice', lastName: 'Smith' },
          { username: 'lecturer2', firstName: 'Bob', lastName: 'Jones' }
        ])
      })
      mockLecturerAvailabilityCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { username: 'lecturer1', duration: 30 },
          { username: 'lecturer2', duration: 45 }
        ])
      })

      const result = await getUpcomingConsultationsForFollowedLecturers('student1', ['lecturer1', 'lecturer2'])

      expect(mockConsultationCollection.find).toHaveBeenCalledWith({
        datetime: { $gt: '2030-05-01T08:00' },
        lecturerId: { $in: ['lecturer1', 'lecturer2'] }
      })
      expect(result).toEqual([
        {
          date: firstDatetime.slice(0, 10),
          hasJoined: true,
          id: firstId.toString(),
          isFull: false,
          lecturer: 'Alice Smith',
          lecturerId: 'lecturer1',
          name: 'Earlier consultation',
          startTime: '09:00',
          time: '09:00 to 09:30'
        },
        {
          date: secondDatetime.slice(0, 10),
          hasJoined: false,
          id: secondId.toString(),
          isFull: true,
          lecturer: 'Bob Jones',
          lecturerId: 'lecturer2',
          name: 'Later consultation',
          startTime: '11:30',
          time: '11:30 to 12:15'
        }
      ])

      jest.useRealTimers()
    })
  })

  describe('cancelConsultation', () => {
    test('returns not-found for an invalid ObjectId', async () => {
      const result = await cancelConsultation('not-a-valid-id', 'student1')

      expect(result).toEqual({ success: false, statusCode: 404, reason: CANCEL_RESULT_REASONS.NOT_FOUND })
      expect(mockConsultationCollection.findOne).not.toHaveBeenCalled()
    })

    test('returns not-found when the consultation does not exist', async () => {
      const id = new ObjectId()
      mockConsultationCollection.findOne.mockResolvedValue(null)

      const result = await cancelConsultation(id.toString(), 'student1')

      expect(result).toEqual({ success: false, statusCode: 404, reason: CANCEL_RESULT_REASONS.NOT_FOUND })
      expect(mockConsultationCollection.deleteOne).not.toHaveBeenCalled()
    })

    test('returns not-organiser when the requester did not create the consultation', async () => {
      const id = new ObjectId()
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      mockConsultationCollection.findOne.mockResolvedValue({ _id: id, datetime: futureDate, organiserId: 'student2' })

      const result = await cancelConsultation(id.toString(), 'student1')

      expect(result).toEqual({ success: false, statusCode: 403, reason: CANCEL_RESULT_REASONS.NOT_ORGANISER })
      expect(mockConsultationCollection.deleteOne).not.toHaveBeenCalled()
    })

    test('returns past-consultation when the consultation datetime has already passed', async () => {
      const id = new ObjectId()
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      mockConsultationCollection.findOne.mockResolvedValue({ _id: id, datetime: pastDate, organiserId: 'student1' })

      const result = await cancelConsultation(id.toString(), 'student1')

      expect(result).toEqual({ success: false, statusCode: 400, reason: CANCEL_RESULT_REASONS.PAST_CONSULTATION })
      expect(mockConsultationCollection.deleteOne).not.toHaveBeenCalled()
    })

    test('deletes the consultation and returns success when all checks pass', async () => {
      const id = new ObjectId()
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      mockConsultationCollection.findOne.mockResolvedValue({ _id: id, datetime: futureDate, organiserId: 'student1' })
      mockConsultationCollection.deleteOne.mockResolvedValue({ deletedCount: 1 })

      const result = await cancelConsultation(id.toString(), 'student1')

      expect(mockConsultationCollection.deleteOne).toHaveBeenCalledWith({ _id: id })
      expect(result).toEqual({ success: true })
    })

    test('returns not-lecturer when the requesting lecturer is not assigned to the consultation', async () => {
      const id = new ObjectId()
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      mockConsultationCollection.findOne.mockResolvedValue({ _id: id, datetime: futureDate, lecturerId: 'lecturer2', organiserId: 'student1' })

      const result = await cancelConsultation(id.toString(), 'lecturer1', 'lecturer')

      expect(result).toEqual({ success: false, statusCode: 403, reason: CANCEL_RESULT_REASONS.NOT_LECTURER })
      expect(mockConsultationCollection.deleteOne).not.toHaveBeenCalled()
    })

    test('deletes the consultation and returns success when the assigned lecturer cancels', async () => {
      const id = new ObjectId()
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      mockConsultationCollection.findOne.mockResolvedValue({ _id: id, datetime: futureDate, lecturerId: 'lecturer1', organiserId: 'student1' })
      mockConsultationCollection.deleteOne.mockResolvedValue({ deletedCount: 1 })

      const result = await cancelConsultation(id.toString(), 'lecturer1', 'lecturer')

      expect(mockConsultationCollection.deleteOne).toHaveBeenCalledWith({ _id: id })
      expect(result).toEqual({ success: true })
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

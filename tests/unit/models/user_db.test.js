jest.mock('../../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { getCollection } = require('../../../src/models/db')
const {
  addUser,
  deleteUser,
  followLecturer,
  getLecturersByUsernames,
  getUser,
  getUserByEmail,
  getUserByGoogleId,
  linkGoogleId,
  searchLecturers,
  searchUsersByAcademicProfile,
  updateUserAcademicProfile,
  updateUserInstitutions
} = require('../../../src/models/user_db')

describe('user database operations', () => {
  let findCursor
  let mockCollection

  beforeEach(() => {
    jest.clearAllMocks()
    findCursor = {
      toArray: jest.fn()
    }
    mockCollection = {
      deleteOne: jest.fn(),
      find: jest.fn().mockReturnValue(findCursor),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn()
    }
    getCollection.mockReturnValue(mockCollection)
  })

  test('getUser queries the User collection by username', async () => {
    const user = { username: 'morris' }
    mockCollection.findOne.mockResolvedValue(user)

    const result = await getUser('morris')

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.findOne).toHaveBeenCalledWith({ username: 'morris' })
    expect(result).toEqual(user)
  })

  test('addUser inserts a document into the User collection', async () => {
    const user = { username: 'morris', role: 'student' }
    const insertResult = { acknowledged: true, insertedId: 'new-user-id' }
    mockCollection.insertOne.mockResolvedValue(insertResult)

    const result = await addUser(user)

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.insertOne).toHaveBeenCalledWith(user)
    expect(result).toEqual(insertResult)
  })

  test('updateUserInstitutions updates university, faculty, and school by username', async () => {
    const updateResult = { acknowledged: true, modifiedCount: 1 }
    mockCollection.updateOne.mockResolvedValue(updateResult)

    const result = await updateUserInstitutions('morris', {
      facultyId: 'Engineering',
      schoolId: 'EIE',
      universityId: 'University of the Witwatersrand'
    })

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { username: 'morris' },
      {
        $set: {
          facultyId: 'Engineering',
          schoolId: 'EIE',
          universityId: 'University of the Witwatersrand'
        }
      }
    )
    expect(result).toEqual(updateResult)
  })

  test('updateUserAcademicProfile updates degree and courses by username', async () => {
    const updateResult = { acknowledged: true, modifiedCount: 1 }
    mockCollection.updateOne.mockResolvedValue(updateResult)

    const result = await updateUserAcademicProfile('morris', {
      courses: ['ELEN Circuit Theory', 'ELEN Electronics'],
      degree: 'BSc (Eng) - Electrical Engineering'
    })

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { username: 'morris' },
      {
        $set: {
          courses: ['ELEN Circuit Theory', 'ELEN Electronics'],
          degree: 'BSc (Eng) - Electrical Engineering'
        }
      }
    )
    expect(result).toEqual(updateResult)
  })

  test('deleteUser removes a document by username', async () => {
    const deleteResult = { acknowledged: true, deletedCount: 1 }
    mockCollection.deleteOne.mockResolvedValue(deleteResult)

    const result = await deleteUser('morris')

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.deleteOne).toHaveBeenCalledWith({ username: 'morris' })
    expect(result).toEqual(deleteResult)
  })

  test('getUserByGoogleId queries the User collection by googleId', async () => {
    const user = { username: 'morris', googleId: 'gid-123' }
    mockCollection.findOne.mockResolvedValue(user)

    const result = await getUserByGoogleId('gid-123')

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.findOne).toHaveBeenCalledWith({ googleId: 'gid-123' })
    expect(result).toEqual(user)
  })

  test('getUserByEmail queries the User collection by email', async () => {
    const user = { username: 'morris', email: 'morris@example.com' }
    mockCollection.findOne.mockResolvedValue(user)

    const result = await getUserByEmail('morris@example.com')

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.findOne).toHaveBeenCalledWith({ email: 'morris@example.com' })
    expect(result).toEqual(user)
  })

  test('linkGoogleId sets the googleId field on a user document by username', async () => {
    const updateResult = { acknowledged: true, modifiedCount: 1 }
    mockCollection.updateOne.mockResolvedValue(updateResult)

    const result = await linkGoogleId('morris', 'gid-123')

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { username: 'morris' },
      { $set: { googleId: 'gid-123' } }
    )
    expect(result).toEqual(updateResult)
  })

  test('getLecturersByUsernames loads matching lecturers in the supplied order', async () => {
    findCursor.toArray.mockResolvedValue([
      { username: 'bob', firstName: 'Bob' },
      { username: 'alice', firstName: 'Alice' }
    ])

    const result = await getLecturersByUsernames(['alice', 'bob'], 'University of the Witwatersrand')

    expect(mockCollection.find).toHaveBeenCalledWith({
      role: 'lecturer',
      universityId: 'University of the Witwatersrand',
      username: { $in: ['alice', 'bob'] }
    })
    expect(result).toEqual([
      { username: 'alice', firstName: 'Alice' },
      { username: 'bob', firstName: 'Bob' }
    ])
  })

  test('followLecturer stores the lecturer username on the student record', async () => {
    const updateResult = { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
    mockCollection.updateOne.mockResolvedValue(updateResult)

    const result = await followLecturer('morris', 'lecturer1')

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { username: 'morris', role: 'student' },
      { $addToSet: { followedLecturers: 'lecturer1' } }
    )
    expect(result).toEqual(updateResult)
  })

  test('searchLecturers filters lecturers within a university and returns cursor results', async () => {
    const lecturers = [{ username: 'alice' }]
    findCursor.toArray.mockResolvedValue(lecturers)

    const result = await searchLecturers({ universityId: 'University of the Witwatersrand' })

    expect(getCollection).toHaveBeenCalledWith('User')
    expect(mockCollection.find).toHaveBeenCalledWith({
      role: 'lecturer',
      universityId: 'University of the Witwatersrand'
    })
    expect(findCursor.toArray).toHaveBeenCalledTimes(1)
    expect(result).toEqual(lecturers)
  })

  test('searchLecturers adds optional faculty and school filters when provided', async () => {
    findCursor.toArray.mockResolvedValue([])

    await searchLecturers({
      facultyId: 'Engineering',
      schoolId: 'EIE',
      universityId: 'University of the Witwatersrand'
    })

    expect(mockCollection.find).toHaveBeenCalledWith({
      facultyId: 'Engineering',
      role: 'lecturer',
      schoolId: 'EIE',
      universityId: 'University of the Witwatersrand'
    })
  })

  test('searchLecturers escapes regex characters and adds both full-name permutations', async () => {
    findCursor.toArray.mockResolvedValue([])

    await searchLecturers({
      query: 'Alice.* Smith?',
      universityId: 'University of the Witwatersrand'
    })

    const filter = mockCollection.find.mock.calls[0][0]

    expect(filter).toMatchObject({
      role: 'lecturer',
      universityId: 'University of the Witwatersrand'
    })
    expect(filter.$or).toHaveLength(5)
    expect(filter.$or[0].username.source).toBe('Alice\\.\\* Smith\\?')
    expect(filter.$or[1].firstName.source).toBe('Alice\\.\\* Smith\\?')
    expect(filter.$or[2].lastName.source).toBe('Alice\\.\\* Smith\\?')
    expect(filter.$or[3].firstName.source).toBe('Alice\\.\\*')
    expect(filter.$or[3].lastName.source).toBe('Smith\\?')
    expect(filter.$or[4].firstName.source).toBe('Smith\\?')
    expect(filter.$or[4].lastName.source).toBe('Alice\\.\\*')
  })

  test('searchUsersByAcademicProfile filters non-lecturer users within a university', async () => {
    const peers = [{ username: 'alice', degree: 'BSc (Eng) - Electrical Engineering' }]
    findCursor.toArray.mockResolvedValue(peers)

    const result = await searchUsersByAcademicProfile({
      excludeUsername: 'morris',
      universityId: 'University of the Witwatersrand'
    })

    expect(mockCollection.find).toHaveBeenCalledWith({
      role: { $in: ['admin', 'student'] },
      universityId: 'University of the Witwatersrand',
      username: { $ne: 'morris' }
    })
    expect(result).toEqual(peers)
  })

  test('searchUsersByAcademicProfile adds degree, course, and name filters', async () => {
    findCursor.toArray.mockResolvedValue([])

    await searchUsersByAcademicProfile({
      course: 'ELEN.*',
      degree: 'Electrical Engineering?',
      excludeUsername: 'morris',
      query: 'Alice Smith',
      universityId: 'University of the Witwatersrand'
    })

    const filter = mockCollection.find.mock.calls[0][0]

    expect(filter).toMatchObject({
      role: { $in: ['admin', 'student'] },
      universityId: 'University of the Witwatersrand',
      username: { $ne: 'morris' }
    })
    expect(filter.degree.source).toBe('Electrical Engineering\\?')
    expect(filter.courses.source).toBe('ELEN\\.\\*')
    expect(filter.$or).toHaveLength(5)
    expect(filter.$or[0].username.source).toBe('Alice Smith')
    expect(filter.$or[3].firstName.source).toBe('Alice')
    expect(filter.$or[3].lastName.source).toBe('Smith')
  })
})

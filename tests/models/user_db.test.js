jest.mock('../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { getCollection } = require('../../src/models/db')
const {
  addUser,
  deleteUser,
  getUser,
  searchLecturers,
  updateUserInstitutions
} = require('../../src/models/user_db')

describe('user model helpers', () => {
  let collection

  beforeEach(() => {
    jest.clearAllMocks()

    collection = {
      deleteOne: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn()
    }

    getCollection.mockReturnValue(collection)
  })

  test('getUser finds a user by username', async () => {
    const user = { username: 'user' }

    collection.findOne.mockResolvedValue(user)

    await expect(getUser('user')).resolves.toEqual(user)
    expect(getCollection).toHaveBeenCalledWith('User')
    expect(collection.findOne).toHaveBeenCalledWith({ username: 'user' })
  })

  test('addUser inserts a user document', async () => {
    const user = { username: 'new-user' }
    const insertResult = { acknowledged: true, insertedId: 'abc123' }

    collection.insertOne.mockResolvedValue(insertResult)

    await expect(addUser(user)).resolves.toEqual(insertResult)
    expect(getCollection).toHaveBeenCalledWith('User')
    expect(collection.insertOne).toHaveBeenCalledWith(user)
  })

  test('updateUserInstitutions stores institution fields for a username', async () => {
    const updateResult = { acknowledged: true, matchedCount: 1, modifiedCount: 1 }

    collection.updateOne.mockResolvedValue(updateResult)

    await expect(updateUserInstitutions('user', {
      universityId: 'University of the Witwatersrand',
      facultyId: 'Engineering and the Built Environment',
      schoolId: 'Electrical and Information Engineering'
    })).resolves.toEqual(updateResult)
    expect(getCollection).toHaveBeenCalledWith('User')
    expect(collection.updateOne).toHaveBeenCalledWith(
      { username: 'user' },
      {
        $set: {
          universityId: 'University of the Witwatersrand',
          facultyId: 'Engineering and the Built Environment',
          schoolId: 'Electrical and Information Engineering'
        }
      }
    )
  })

  test('deleteUser removes a user by username', async () => {
    const deleteResult = { acknowledged: true, deletedCount: 1 }

    collection.deleteOne.mockResolvedValue(deleteResult)

    await expect(deleteUser('user')).resolves.toEqual(deleteResult)
    expect(getCollection).toHaveBeenCalledWith('User')
    expect(collection.deleteOne).toHaveBeenCalledWith({ username: 'user' })
  })

  test('searchLecturers finds lecturers within a university when no filters are provided', async () => {
    const lecturers = [{ username: 'lecturer-1' }]
    const lecturerCursor = {
      toArray: jest.fn()
    }

    lecturerCursor.toArray.mockResolvedValue(lecturers)
    collection.find.mockReturnValue(lecturerCursor)

    await expect(searchLecturers({ universityId: 'University of the Witwatersrand' })).resolves.toEqual(lecturers)
    expect(getCollection).toHaveBeenCalledWith('User')
    expect(collection.find).toHaveBeenCalledWith({
      role: 'lecturer',
      universityId: 'University of the Witwatersrand'
    })
  })

  test('searchLecturers adds faculty and school filters when provided', async () => {
    const lecturerCursor = {
      toArray: jest.fn()
    }

    lecturerCursor.toArray.mockResolvedValue([])
    collection.find.mockReturnValue(lecturerCursor)

    await searchLecturers({
      facultyId: 'Engineering and the Built Environment',
      schoolId: 'Electrical and Information Engineering',
      universityId: 'University of the Witwatersrand'
    })

    expect(collection.find).toHaveBeenCalledWith({
      facultyId: 'Engineering and the Built Environment',
      role: 'lecturer',
      schoolId: 'Electrical and Information Engineering',
      universityId: 'University of the Witwatersrand'
    })
  })

  test('searchLecturers builds case-insensitive regex filters for a single query', async () => {
    const lecturerCursor = {
      toArray: jest.fn()
    }

    lecturerCursor.toArray.mockResolvedValue([])
    collection.find.mockReturnValue(lecturerCursor)

    await searchLecturers({
      query: 'alice',
      universityId: 'University of the Witwatersrand'
    })

    const filter = collection.find.mock.calls[0][0]

    expect(filter.role).toBe('lecturer')
    expect(filter.universityId).toBe('University of the Witwatersrand')
    expect(filter.$or).toHaveLength(3)

    for (const [index, field] of ['username', 'firstName', 'lastName'].entries()) {
      expect(filter.$or[index]).toHaveProperty(field)
      expect(filter.$or[index][field]).toBeInstanceOf(RegExp)
      expect(filter.$or[index][field].source).toBe('alice')
      expect(filter.$or[index][field].flags).toBe('i')
    }
  })

  test('searchLecturers supports full-name queries in both directions and escapes regex characters', async () => {
    const lecturerCursor = {
      toArray: jest.fn()
    }

    lecturerCursor.toArray.mockResolvedValue([])
    collection.find.mockReturnValue(lecturerCursor)

    await searchLecturers({
      query: 'Ali.ce Smi(th)',
      universityId: 'University of the Witwatersrand'
    })

    const filter = collection.find.mock.calls[0][0]

    expect(filter.$or).toHaveLength(5)
    expect(filter.$or[0].username.source).toBe('Ali\\.ce Smi\\(th\\)')
    expect(filter.$or[0].username.flags).toBe('i')
    expect(filter.$or[3].firstName.source).toBe('Ali\\.ce')
    expect(filter.$or[3].firstName.flags).toBe('i')
    expect(filter.$or[3].lastName.source).toBe('Smi\\(th\\)')
    expect(filter.$or[3].lastName.flags).toBe('i')
    expect(filter.$or[4].firstName.source).toBe('Smi\\(th\\)')
    expect(filter.$or[4].lastName.source).toBe('Ali\\.ce')
  })
})

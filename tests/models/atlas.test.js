const {
  closeDatabaseConnection,
  connectToDatabase,
  DATABASE_NAME,
  getDb
} = require('../../src/models/db')
const {
  addUser,
  deleteUser,
  getUser,
  searchLecturers,
  updateUserInstitutions
} = require('../../src/models/user_db')
const {
  getFaculty,
  getSchool,
  getUniversity,
  searchFaculties,
  searchSchools,
  searchUniversities,
  isFacultyInUniversity,
  isSchoolInFaculty
} = require('../../src/models/university_db')

const RUN_DB_TEST = process.env.MONGODB_URI ? test : test.skip
const USER_COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || 'User'
const EXPECTED_COLLECTIONS = ['University', 'Faculty', 'School', USER_COLLECTION_NAME]

const EXPECTED_UNIVERSITY = {
  _id: '69e7d58c5db99de0cf001bf0',
  city: 'Johannesburg',
  country: 'South Africa',
  name: 'University of the Witwatersrand'
}

const EXPECTED_FACULTY = {
  _id: '69e7d63e5db99de0cf001bf2',
  name: 'Engineering and the Built Environment',
  universityId: EXPECTED_UNIVERSITY._id,
  universityName: EXPECTED_UNIVERSITY.name
}

const EXPECTED_SCHOOL = {
  _id: '69e7d9025db99de0cf001bfe',
  facultyId: EXPECTED_FACULTY._id,
  facultyName: EXPECTED_FACULTY.name,
  name: 'Electrical and Information Engineering',
  universityId: EXPECTED_UNIVERSITY._id,
  universityName: EXPECTED_UNIVERSITY.name
}

const EXPECTED_USER = {
  _id: '69e807ee1d7f14dc00c23b3b',
  email: 'test@email.com',
  facultyId: 'Engineering and the Built Environment',
  firstName: 'Test',
  lastName: 'User',
  passwordHash: '5575b9e488a4b6f4bdf1516cde2080fb:e874e018fd925529df6149ce865a26f0339c6f48b004a963444a3dd53964303a92a5dcd51ae0c6ff30a8764e1c437152761b596e8e0647498a29c6eba0d98a34',
  role: 'student',
  schoolId: 'Electrical and Information Engineering',
  universityId: 'University of the Witwatersrand',
  username: 'user'
}

const EXPECTED_USER_FIELDS = [
  '_id',
  'email',
  'facultyId',
  'firstName',
  'lastName',
  'passwordHash',
  'role',
  'schoolId',
  'universityId',
  'username'
]

const createTestUser = function (overrides = {}) {
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return {
    email: `newUser_${uniqueSuffix}@email.com`,
    facultyId: `faculty_${uniqueSuffix}`,
    firstName: 'newUser',
    lastName: 'newUser',
    passwordHash: `password_${uniqueSuffix}`,
    role: 'student',
    schoolId: `school_${uniqueSuffix}`,
    universityId: `uni_${uniqueSuffix}`,
    username: `WeLoveNoSQL_${uniqueSuffix}`,
    ...overrides
  }
}

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    return
  }

  await connectToDatabase()
})

afterAll(async () => {
  await closeDatabaseConnection()
})

describe('MongoDB Atlas dB setup', () => {
  RUN_DB_TEST('Connects to Atlas and finds the expected collections', async () => {
    const collections = await getDb()
      .listCollections({}, { nameOnly: true })
      .toArray()

    const collectionNames = collections.map((collection) => collection.name)

    expect(DATABASE_NAME).toBe('LetsTalk')
    expect(collectionNames).toEqual(expect.arrayContaining(EXPECTED_COLLECTIONS))
  })
})

describe('MongoDB Atlas institution lookups', () => {
  RUN_DB_TEST('Returns the expected university by name', async () => {
    const university = await getUniversity(EXPECTED_UNIVERSITY.name)

    expect(university).not.toBeNull()
    expect(university).toMatchObject({
      city: EXPECTED_UNIVERSITY.city,
      country: EXPECTED_UNIVERSITY.country,
      name: EXPECTED_UNIVERSITY.name
    })
    expect(university._id.toString()).toBe(EXPECTED_UNIVERSITY._id)
  })

  RUN_DB_TEST('Returns matching universities for a partial query', async () => {
    const universities = await searchUniversities('wit', 5)

    expect(universities).toEqual(
      expect.arrayContaining([
        {
          name: EXPECTED_UNIVERSITY.name
        }
      ])
    )
  })

  RUN_DB_TEST('Returns matching faculties for a partial query within a university', async () => {
    const faculties = await searchFaculties('eng', {
      limit: 5,
      university: EXPECTED_UNIVERSITY.name
    })

    expect(faculties).toEqual(
      expect.arrayContaining([
        {
          name: EXPECTED_FACULTY.name
        }
      ])
    )
  })

  RUN_DB_TEST('Returns matching schools for a partial query within a faculty', async () => {
    const schools = await searchSchools('elect', {
      faculty: EXPECTED_FACULTY.name,
      limit: 5,
      university: EXPECTED_UNIVERSITY.name
    })

    expect(schools).toEqual(
      expect.arrayContaining([
        {
          name: EXPECTED_SCHOOL.name
        }
      ])
    )
  })

  RUN_DB_TEST('Returns the expected faculty by id', async () => {
    const faculty = await getFaculty(EXPECTED_FACULTY._id)

    expect(faculty).not.toBeNull()
    expect(faculty).toMatchObject({
      name: EXPECTED_FACULTY.name,
      universityName: EXPECTED_FACULTY.universityName
    })
    expect(faculty._id.toString()).toBe(EXPECTED_FACULTY._id)
    expect(faculty.universityId.toString()).toBe(EXPECTED_FACULTY.universityId)
  })

  RUN_DB_TEST('Returns the expected school by id', async () => {
    const school = await getSchool(EXPECTED_SCHOOL._id)

    expect(school).not.toBeNull()
    expect(school).toMatchObject({
      facultyName: EXPECTED_SCHOOL.facultyName,
      name: EXPECTED_SCHOOL.name,
      universityName: EXPECTED_SCHOOL.universityName
    })
    expect(school._id.toString()).toBe(EXPECTED_SCHOOL._id)
    expect(school.facultyId.toString()).toBe(EXPECTED_SCHOOL.facultyId)
    expect(school.universityId.toString()).toBe(EXPECTED_SCHOOL.universityId)
  })

  RUN_DB_TEST('Confirms the faculty belongs to the university', async () => {
    await expect(
      isFacultyInUniversity(EXPECTED_FACULTY._id, EXPECTED_UNIVERSITY._id)
    ).resolves.toBe(true)
  })

  RUN_DB_TEST('Confirms the school belongs to the faculty', async () => {
    await expect(
      isSchoolInFaculty(EXPECTED_SCHOOL._id, EXPECTED_FACULTY._id)
    ).resolves.toBe(true)
  })
})

describe('MongoDB Atlas user lookups', () => {
  RUN_DB_TEST('Returns the expected test user by username', async () => {
    const user = await getUser(EXPECTED_USER.username)

    expect(user).not.toBeNull()
    expect(user).toMatchObject({
      email: EXPECTED_USER.email,
      facultyId: EXPECTED_USER.facultyId,
      firstName: EXPECTED_USER.firstName,
      lastName: EXPECTED_USER.lastName,
      passwordHash: EXPECTED_USER.passwordHash,
      role: EXPECTED_USER.role,
      schoolId: EXPECTED_USER.schoolId,
      universityId: EXPECTED_USER.universityId,
      username: EXPECTED_USER.username
    })
    expect(user._id.toString()).toBe(EXPECTED_USER._id)
  })

  RUN_DB_TEST('Includes all expected fields on the test user document', async () => {
    const user = await getUser(EXPECTED_USER.username)

    expect(user).not.toBeNull()
    for (const field of EXPECTED_USER_FIELDS) {
      expect(user).toHaveProperty(field)
    }
  })

  RUN_DB_TEST('Adds a new user document to the User collection', async () => {
    const newUser = createTestUser()

    try {
      const insertResult = await addUser(newUser)
      expect(insertResult.acknowledged).toBe(true)
      expect(insertResult.insertedId).toBeDefined()

      const insertedUser = await getUser(newUser.username)
      expect(insertedUser).not.toBeNull()
      expect(insertedUser).toMatchObject(newUser)
      expect(insertedUser._id.toString()).toBe(insertResult.insertedId.toString())
    } finally {
      await deleteUser(newUser.username)
    }
  })

  RUN_DB_TEST('Updates a user document institution fields by username', async () => {
    const newUser = createTestUser()
    const updatedInstitutions = {
      facultyId: `updated_faculty_${Date.now()}`,
      schoolId: `updated_school_${Date.now()}`,
      universityId: `updated_university_${Date.now()}`
    }

    try {
      await addUser(newUser)

      const updateResult = await updateUserInstitutions(newUser.username, updatedInstitutions)
      expect(updateResult.acknowledged).toBe(true)
      expect(updateResult.modifiedCount).toBe(1)

      const updatedUser = await getUser(newUser.username)
      expect(updatedUser).toMatchObject(updatedInstitutions)
    } finally {
      await deleteUser(newUser.username)
    }
  })

  RUN_DB_TEST('Deletes a user document from the User collection', async () => {
    const newUser = createTestUser()

    try {
      await addUser(newUser)

      const deleteResult = await deleteUser(newUser.username)
      expect(deleteResult.acknowledged).toBe(true)
      expect(deleteResult.deletedCount).toBe(1)

      const deletedUser = await getUser(newUser.username)
      expect(deletedUser).toBeNull()
    } finally {
      await deleteUser(newUser.username)
    }
  })

  RUN_DB_TEST('Rejects a user when role is not lecturer or student', async () => {
    const invalidUser = createTestUser({ role: 'admin' })

    await expect(addUser(invalidUser)).rejects.toMatchObject({
      name: expect.stringMatching(/Mongo/),
      message: expect.stringMatching(/validation|document failed/i)
    })

    await deleteUser(invalidUser.username)
  })

  RUN_DB_TEST('Rejects creating two users with the same username', async () => {
    const originalUser = createTestUser()
    const duplicateUser = createTestUser({
      email: 'duplicate@email.com',
      username: originalUser.username
    })

    try {
      await addUser(originalUser)
      await expect(addUser(duplicateUser)).rejects.toMatchObject({
        code: 11000
      })
    } finally {
      await deleteUser(originalUser.username)
      await deleteUser(duplicateUser.username)
    }
  })
})

describe('MongoDB Atlas lecturer search', () => {
  const lecturer = createTestUser({
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'lecturer'
  })

  beforeAll(async () => {
    if (!process.env.MONGODB_URI) {
      return
    }

    await addUser(lecturer)
  })

  afterAll(async () => {
    if (!process.env.MONGODB_URI) {
      return
    }

    await deleteUser(lecturer.username)
  })

  RUN_DB_TEST('Finds a lecturer when first name is entered before surname', async () => {
    const results = await searchLecturers({
      query: 'Alice Smith',
      universityId: lecturer.universityId
    })
    const usernames = results.map((result) => result.username)

    expect(usernames).toContain(lecturer.username)
  })

  RUN_DB_TEST('Finds a lecturer when surname is entered before first name', async () => {
    const results = await searchLecturers({
      query: 'Smith Alice',
      universityId: lecturer.universityId
    })
    const usernames = results.map((result) => result.username)

    expect(usernames).toContain(lecturer.username)
  })
})

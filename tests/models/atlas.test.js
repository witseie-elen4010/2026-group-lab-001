const {
  closeDatabaseConnection,
  connectToDatabase,
  DATABASE_NAME,
  getDb
} = require('../../src/models/db')
const {
  getFaculty,
  getSchool,
  getUniversity,
  isFacultyInUniversity,
  isSchoolInFaculty
} = require('../../src/models/university_db')

const RUN_DB_TEST = process.env.MONGODB_URI ? test : test.skip
const EXPECTED_COLLECTIONS = ['University', 'Faculty', 'School']

const EXPECTED_UNIVERSITY = {
  _id: '69e7d58c5db99de0cf001bf0',
  city: 'Johannesburg',
  country: 'South Africa',
  name: 'University of the Witwatersrand'
}

const EXPECTED_FACULTY = {
  _id: '69e7d63e5db99de0cf001bf2',
  name: 'Engineering and the Built Environment',
  universityID: EXPECTED_UNIVERSITY._id,
  universityName: EXPECTED_UNIVERSITY.name
}

const EXPECTED_SCHOOL = {
  _id: '69e7d9025db99de0cf001bfe',
  facultyID: EXPECTED_FACULTY._id,
  facultyName: EXPECTED_FACULTY.name,
  name: 'Electrical and Information Engineering',
  universityID: EXPECTED_UNIVERSITY._id,
  universityName: EXPECTED_UNIVERSITY.name
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

describe('MongoDB Atlas Institutions dB setup', () => {
  RUN_DB_TEST('Connects to Atlas and finds the institution collections', async () => {
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

  RUN_DB_TEST('Returns the expected faculty by id', async () => {
    const faculty = await getFaculty(EXPECTED_FACULTY._id)

    expect(faculty).not.toBeNull()
    expect(faculty).toMatchObject({
      name: EXPECTED_FACULTY.name,
      universityName: EXPECTED_FACULTY.universityName
    })
    expect(faculty._id.toString()).toBe(EXPECTED_FACULTY._id)
    expect(faculty.universityID.toString()).toBe(EXPECTED_FACULTY.universityID)
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
    expect(school.facultyID.toString()).toBe(EXPECTED_SCHOOL.facultyID)
    expect(school.universityID.toString()).toBe(EXPECTED_SCHOOL.universityID)
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

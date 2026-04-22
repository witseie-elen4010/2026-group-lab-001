const { ObjectId } = require('mongodb')

jest.mock('../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { getCollection } = require('../../src/models/db')
const {
  getFaculty,
  getSchool,
  getUniversity,
  isFacultyInUniversity,
  isSchoolInFaculty
} = require('../../src/models/university_db')

describe('institution relationship lookups', () => {
  let collections

  beforeEach(() => {
    collections = {
      Faculty: { findOne: jest.fn() },
      School: { findOne: jest.fn() },
      University: { findOne: jest.fn() }
    }

    getCollection.mockImplementation((name) => collections[name])
  })

  test('getUniversity finds a university by name', async () => {
    const university = {
      name: 'University of the Witwatersrand'
    }

    collections.University.findOne.mockResolvedValue(university)

    await expect(getUniversity('University of the Witwatersrand')).resolves.toEqual(university)
    expect(collections.University.findOne).toHaveBeenCalledWith({
      name: 'University of the Witwatersrand'
    })
  })

  test('getFaculty finds a faculty by id', async () => {
    const facultyId = new ObjectId()
    const faculty = {
      _id: facultyId,
      name: 'Engineering and the Built Environment',
      universityID: new ObjectId()
    }

    collections.Faculty.findOne.mockResolvedValue(faculty)

    await expect(getFaculty(facultyId.toHexString())).resolves.toEqual(faculty)
    expect(collections.Faculty.findOne).toHaveBeenCalledWith({ _id: facultyId })
  })

  test('getSchool finds a school by id', async () => {
    const schoolId = new ObjectId()
    const school = {
      _id: schoolId,
      facultyID: new ObjectId(),
      name: 'Electrical and Information Engineering',
      universityID: new ObjectId()
    }

    collections.School.findOne.mockResolvedValue(school)

    await expect(getSchool(schoolId.toHexString())).resolves.toEqual(school)
    expect(collections.School.findOne).toHaveBeenCalledWith({ _id: schoolId })
  })

  test('isFacultyInUniversity returns true when the faculty belongs to the university', async () => {
    const facultyId = new ObjectId()
    const universityId = new ObjectId()
    const faculty = {
      _id: facultyId,
      name: 'Engineering and the Built Environment',
      universityID: universityId
    }
    const university = {
      _id: universityId,
      name: 'University of the Witwatersrand'
    }

    collections.Faculty.findOne.mockResolvedValue(faculty)
    collections.University.findOne.mockResolvedValue(university)

    await expect(isFacultyInUniversity(facultyId.toHexString(), universityId.toHexString())).resolves.toBe(true)
    expect(collections.Faculty.findOne).toHaveBeenCalledWith({ _id: facultyId })
    expect(collections.University.findOne).toHaveBeenCalledWith({ _id: universityId })
  })

  test('isSchoolInFaculty returns true when the school belongs to the faculty', async () => {
    const facultyId = new ObjectId()
    const schoolId = new ObjectId()
    const school = {
      _id: schoolId,
      facultyID: facultyId,
      name: 'Electrical and Information Engineering',
      universityID: new ObjectId()
    }
    const faculty = {
      _id: facultyId,
      name: 'Engineering and the Built Environment'
    }

    collections.School.findOne.mockResolvedValue(school)
    collections.Faculty.findOne.mockResolvedValue(faculty)

    await expect(isSchoolInFaculty(schoolId.toHexString(), facultyId.toHexString())).resolves.toBe(true)
    expect(collections.School.findOne).toHaveBeenCalledWith({ _id: schoolId })
    expect(collections.Faculty.findOne).toHaveBeenCalledWith({ _id: facultyId })
  })
})

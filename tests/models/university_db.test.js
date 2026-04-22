const { ObjectId } = require('mongodb')

jest.mock('../../src/models/db', () => ({
  getCollection: jest.fn()
}))

const { getCollection } = require('../../src/models/db')
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

describe('institution relationship lookups', () => {
  let collections

  beforeEach(() => {
    collections = {
      Faculty: { find: jest.fn(), findOne: jest.fn() },
      School: { find: jest.fn(), findOne: jest.fn() },
      University: { find: jest.fn(), findOne: jest.fn() }
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

  test('searchUniversities returns matching universities for a query', async () => {
    const universityCursor = {
      limit: jest.fn(),
      sort: jest.fn(),
      toArray: jest.fn()
    }

    universityCursor.sort.mockReturnValue(universityCursor)
    universityCursor.limit.mockReturnValue(universityCursor)
    universityCursor.toArray.mockResolvedValue([
      {
        name: 'University of the Witwatersrand'
      }
    ])

    collections.University.find.mockReturnValue(universityCursor)

    await expect(searchUniversities('wit', 5)).resolves.toEqual([
      {
        name: 'University of the Witwatersrand'
      }
    ])
    expect(collections.University.find).toHaveBeenCalledWith(
      {
        name: {
          $options: 'i',
          $regex: 'wit'
        }
      },
      {
        projection: {
          _id: 0,
          name: 1
        }
      }
    )
    expect(universityCursor.sort).toHaveBeenCalledWith({ name: 1 })
    expect(universityCursor.limit).toHaveBeenCalledWith(5)
  })

  test('searchFaculties filters faculties by university name', async () => {
    const facultyCursor = {
      limit: jest.fn(),
      sort: jest.fn(),
      toArray: jest.fn()
    }

    facultyCursor.sort.mockReturnValue(facultyCursor)
    facultyCursor.limit.mockReturnValue(facultyCursor)
    facultyCursor.toArray.mockResolvedValue([
      {
        name: 'Engineering and the Built Environment'
      }
    ])

    collections.Faculty.find.mockReturnValue(facultyCursor)

    await expect(searchFaculties('eng', {
      limit: 4,
      university: 'University of the Witwatersrand'
    })).resolves.toEqual([
      {
        name: 'Engineering and the Built Environment'
      }
    ])
    expect(collections.Faculty.find).toHaveBeenCalledWith(
      {
        name: {
          $options: 'i',
          $regex: 'eng'
        },
        universityName: 'University of the Witwatersrand'
      },
      {
        projection: {
          _id: 0,
          name: 1
        }
      }
    )
    expect(facultyCursor.limit).toHaveBeenCalledWith(4)
  })

  test('searchSchools filters schools by university and faculty names', async () => {
    const schoolCursor = {
      limit: jest.fn(),
      sort: jest.fn(),
      toArray: jest.fn()
    }

    schoolCursor.sort.mockReturnValue(schoolCursor)
    schoolCursor.limit.mockReturnValue(schoolCursor)
    schoolCursor.toArray.mockResolvedValue([
      {
        name: 'Electrical and Information Engineering'
      }
    ])

    collections.School.find.mockReturnValue(schoolCursor)

    await expect(searchSchools('elect', {
      faculty: 'Engineering and the Built Environment',
      limit: 3,
      university: 'University of the Witwatersrand'
    })).resolves.toEqual([
      {
        name: 'Electrical and Information Engineering'
      }
    ])
    expect(collections.School.find).toHaveBeenCalledWith(
      {
        facultyName: 'Engineering and the Built Environment',
        name: {
          $options: 'i',
          $regex: 'elect'
        },
        universityName: 'University of the Witwatersrand'
      },
      {
        projection: {
          _id: 0,
          name: 1
        }
      }
    )
    expect(schoolCursor.limit).toHaveBeenCalledWith(3)
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

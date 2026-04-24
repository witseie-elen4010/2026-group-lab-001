jest.mock('../../src/models/university_db', () => ({
  getFaculty: jest.fn(),
  getSchool: jest.fn(),
  getUniversity: jest.fn(),
  isFacultyInUniversity: jest.fn(),
  isSchoolInFaculty: jest.fn()
}))

const {
  getFaculty,
  getSchool,
  getUniversity,
  isFacultyInUniversity,
  isSchoolInFaculty
} = require('../../src/models/university_db')
const { validateSelection } = require('../../src/services/institution_validation')

describe('institution validation service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUniversity.mockResolvedValue({ name: 'University of the Witwatersrand' })
    getFaculty.mockResolvedValue({ name: 'Engineering and the Built Environment' })
    getSchool.mockResolvedValue({ name: 'Electrical and Information Engineering' })
    isFacultyInUniversity.mockResolvedValue(true)
    isSchoolInFaculty.mockResolvedValue(true)
  })

  test('Defaults missing selection values to empty strings', async () => {
    getUniversity.mockResolvedValue(null)

    await expect(validateSelection()).resolves.toEqual({
      error: 'Choose a university from the database list.',
      isValid: false,
      statusCode: 400
    })
    expect(getUniversity).toHaveBeenCalledWith('')
  })

  test('Returns an error when the university does not exist', async () => {
    getUniversity.mockResolvedValue(null)

    await expect(validateSelection({
      faculty: 'Engineering and the Built Environment',
      school: 'Electrical and Information Engineering',
      university: 'crazyTown'
    })).resolves.toEqual({
      error: 'Choose a university from the database list.',
      isValid: false,
      statusCode: 400
    })
  })

  test('Returns an error when the faculty does not exist', async () => {
    getFaculty.mockResolvedValue(null)

    await expect(validateSelection({
      faculty: 'crazyTown',
      school: 'Electrical and Information Engineering',
      university: 'University of the Witwatersrand'
    })).resolves.toEqual({
      error: 'Choose a faculty from the database list.',
      isValid: false,
      statusCode: 400
    })
  })

  test('Returns an error when the faculty does not belong to the university', async () => {
    isFacultyInUniversity.mockResolvedValue(false)

    await expect(validateSelection({
      faculty: 'Engineering and the Built Environment',
      school: 'Electrical and Information Engineering',
      university: 'University of the Witwatersrand'
    })).resolves.toEqual({
      error: 'Choose a faculty that belongs to the selected university.',
      isValid: false,
      statusCode: 400
    })
  })

  test('Returns an error when the school does not exist', async () => {
    getSchool.mockResolvedValue(null)

    await expect(validateSelection({
      faculty: 'Engineering and the Built Environment',
      school: 'crazyTown',
      university: 'University of the Witwatersrand'
    })).resolves.toEqual({
      error: 'Choose a school from the database list.',
      isValid: false,
      statusCode: 400
    })
  })

  test('Returns an error when the school does not belong to the faculty', async () => {
    isSchoolInFaculty.mockResolvedValue(false)

    await expect(validateSelection({
      faculty: 'Engineering and the Built Environment',
      school: 'Electrical and Information Engineering',
      university: 'University of the Witwatersrand'
    })).resolves.toEqual({
      error: 'Choose a school that belongs to the selected faculty.',
      isValid: false,
      statusCode: 400
    })
  })

  test('Returns matched institution documents when the selection is valid', async () => {
    const matchedUniversity = { name: 'University of the Witwatersrand' }
    const matchedFaculty = { name: 'Engineering and the Built Environment' }
    const matchedSchool = { name: 'Electrical and Information Engineering' }

    getUniversity.mockResolvedValue(matchedUniversity)
    getFaculty.mockResolvedValue(matchedFaculty)
    getSchool.mockResolvedValue(matchedSchool)

    await expect(validateSelection({
      faculty: 'Engineering and the Built Environment',
      school: 'Electrical and Information Engineering',
      university: 'University of the Witwatersrand'
    })).resolves.toEqual({
      isValid: true,
      matchedFaculty,
      matchedSchool,
      matchedUniversity
    })
  })
})

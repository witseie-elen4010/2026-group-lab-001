const {
  getFaculty,
  getSchool,
  getUniversity,
  isFacultyInUniversity,
  isSchoolInFaculty
} = require('../models/university_db')

const createValidationFailure = function (error, statusCode = 400) {
  return {
    error,
    isValid: false,
    statusCode
  }
}

/**
 * Validates that the selected university, faculty, and school exist and match.
 * @param {object} selection - Institution values supplied by a form.
 * @param {string} [selection.university=''] - Selected university name.
 * @param {string} [selection.faculty=''] - Selected faculty name.
 * @param {string} [selection.school=''] - Selected school name.
 * @returns {Promise<object>} Validation result containing status and matched institutions.
 */
const validateSelection = async function ({
  university = '',
  faculty = '',
  school = ''
} = {}) {
  const matchedUniversity = await getUniversity(university)

  if (!matchedUniversity) {
    return createValidationFailure('Choose a university from the database list.')
  }

  const matchedFaculty = await getFaculty(faculty)

  if (!matchedFaculty) {
    return createValidationFailure('Choose a faculty from the database list.')
  }

  if (!(await isFacultyInUniversity(matchedFaculty, matchedUniversity))) {
    return createValidationFailure('Choose a faculty that belongs to the selected university.')
  }

  const matchedSchool = await getSchool(school)

  if (!matchedSchool) {
    return createValidationFailure('Choose a school from the database list.')
  }

  if (!(await isSchoolInFaculty(matchedSchool, matchedFaculty))) {
    return createValidationFailure('Choose a school that belongs to the selected faculty.')
  }

  return {
    isValid: true,
    matchedFaculty,
    matchedSchool,
    matchedUniversity
  }
}

module.exports = {
  validateSelection
}

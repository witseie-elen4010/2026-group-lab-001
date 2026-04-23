const { ObjectId } = require('mongodb')
const { getCollection } = require('./db')

const UNIVERSITY_COLLECTION_NAME = 'University'
const FACULTY_COLLECTION_NAME = 'Faculty'
const SCHOOL_COLLECTION_NAME = 'School'

const universitiesCollection = function () {
  return getCollection(UNIVERSITY_COLLECTION_NAME)
}

const facultiesCollection = function () {
  return getCollection(FACULTY_COLLECTION_NAME)
}

const schoolsCollection = function () {
  return getCollection(SCHOOL_COLLECTION_NAME)
}

const escapeRegularExpression = function (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// cleans user input text to query against institution collections
const searchByName = async function (collection, query, { filters = {}, limit = 10 } = {}) {
  const normalizedQuery = query?.trim() || ''

  if (!normalizedQuery) {
    return []
  }
  return collection
    .find(
      {
        ...filters,
        name: {
          $regex: escapeRegularExpression(normalizedQuery), // ignore regexes
          $options: 'i' // case-insensitive for querying
        }
      },
      {
        projection: {
          _id: 0, // to ONLY return the name - not the rest of the entries
          name: 1
        }
      }
    )
    .sort({ name: 1 }) // returns alphabetised list
    .limit(limit)
    .toArray()
}

/**
 * Converts a supported value into a MongoDB ObjectId.
 * @param {string|import('mongodb').ObjectId} value - Value to convert.
 * @returns {import('mongodb').ObjectId|null} ObjectId value or null.
 */
const toObjectId = function (value) {
  if (value instanceof ObjectId) {
    return value
  }
  if (typeof value === 'string' && ObjectId.isValid(value)) {
    return new ObjectId(value)
  }
  return null
}

const idsMatch = function (left, right) {
  const leftId = toObjectId(left)
  const rightId = toObjectId(right)

  if (!leftId || !rightId) {
    return false
  }
  return leftId.equals(rightId)
}

/**
 * Finds an institution document by ObjectId, name, or direct object value.
 * @param {import('mongodb').Collection} collection - Collection to query.
 * @param {string|object|import('mongodb').ObjectId} value - Lookup value.
 * @returns {Promise<object|null>} The matching document or null.
 */
const findByIdOrName = async function (collection, value) {
  const documentId = toObjectId(value)

  if (documentId) {
    return collection.findOne({ _id: documentId })
  }
  if (value && typeof value === 'object') {
    return value
  }
  if (typeof value === 'string') {
    return collection.findOne({ name: value })
  }
  return null
}

/**
 * Returns a university document by id or name.
 * @param {string|object|import('mongodb').ObjectId} university - University identifier.
 * @returns {Promise<object|null>} The matching university or null.
 */
const getUniversity = async function (university) {
  return findByIdOrName(universitiesCollection(), university)
}

/**
 * Returns universities whose names match a partial query.
 * @param {string} query - Partial university name to search for.
 * @param {number} [limit=10] - Maximum number of results to return.
 * @returns {Promise<Array<{name: string}>>} Matching universities.
 */
const searchUniversities = async function (query, limit = 10) {
  return searchByName(universitiesCollection(), query, { limit })
}

/**
 * Returns faculties whose names match a partial query.
 * @param {string} query - Partial faculty name to search for.
 * @param {object} [options={}] - Optional faculty search filters.
 * @param {string} [options.university=''] - University name to filter faculties by.
 * @param {number} [options.limit=10] - Maximum number of results to return.
 * @returns {Promise<Array<{name: string}>>} Matching faculties.
 */
const searchFaculties = async function (query, { university = '', limit = 10 } = {}) {
  const filters = {}

  if (university) {
    filters.universityName = university
  }
  return searchByName(facultiesCollection(), query, {
    filters,
    limit
  })
}

/**
 * Returns schools whose names match a partial query.
 * @param {string} query - Partial school name to search for.
 * @param {object} [options={}] - Optional school search filters.
 * @param {string} [options.university=''] - University name to filter schools by.
 * @param {string} [options.faculty=''] - Faculty name to filter schools by.
 * @param {number} [options.limit=10] - Maximum number of results to return.
 * @returns {Promise<Array<{name: string}>>} Matching schools.
 */
const searchSchools = async function (query, { university = '', faculty = '', limit = 10 } = {}) {
  const filters = {}

  if (university) {
    filters.universityName = university
  }
  if (faculty) {
    filters.facultyName = faculty
  }
  return searchByName(schoolsCollection(), query, {
    filters,
    limit
  })
}

/**
 * Returns a faculty document by id or name.
 * @param {string|object|import('mongodb').ObjectId} faculty - Faculty identifier.
 * @returns {Promise<object|null>} The matching faculty or null.
 */
const getFaculty = async function (faculty) {
  return findByIdOrName(facultiesCollection(), faculty)
}

/**
 * Returns a school document by id or name.
 * @param {string|object|import('mongodb').ObjectId} school - School identifier.
 * @returns {Promise<object|null>} The matching school or null.
 */
const getSchool = async function (school) {
  return findByIdOrName(schoolsCollection(), school)
}

/**
 * Checks whether a faculty belongs to a university.
 * @param {string|object|import('mongodb').ObjectId} faculty - Faculty identifier.
 * @param {string|object|import('mongodb').ObjectId} university - University identifier.
 * @returns {Promise<boolean>} True when the faculty belongs to the university.
 */
const isFacultyInUniversity = async function (faculty, university) {
  const facultyDocument = await getFaculty(faculty)
  const universityDocument = await getUniversity(university)

  if (!facultyDocument || !universityDocument) {
    return false
  }
  return idsMatch(facultyDocument.universityId, universityDocument._id)
}

/**
 * Checks whether a school belongs to a faculty.
 * @param {string|object|import('mongodb').ObjectId} school - School identifier.
 * @param {string|object|import('mongodb').ObjectId} faculty - Faculty identifier.
 * @returns {Promise<boolean>} True when the school belongs to the faculty.
 */
const isSchoolInFaculty = async function (school, faculty) {
  const schoolDocument = await getSchool(school)
  const facultyDocument = await getFaculty(faculty)

  if (!schoolDocument || !facultyDocument) {
    return false
  }
  return idsMatch(schoolDocument.facultyId, facultyDocument._id)
}

module.exports = {
  getFaculty,
  getSchool,
  getUniversity,
  searchFaculties,
  searchSchools,
  searchUniversities,
  isFacultyInUniversity,
  isSchoolInFaculty
}

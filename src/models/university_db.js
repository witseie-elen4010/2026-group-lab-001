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

  return idsMatch(facultyDocument.universityID, universityDocument._id)
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

  return idsMatch(schoolDocument.facultyID, facultyDocument._id)
}

module.exports = {
  getFaculty,
  getSchool,
  getUniversity,
  isFacultyInUniversity,
  isSchoolInFaculty
}

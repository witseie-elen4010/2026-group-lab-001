const { ObjectId } = require('mongodb')
const { getCollection } = require('./db')

function universitiesCollection () {
  return getCollection('University')
}
function facultiesCollection () {
  return getCollection('Faculty')
}
function schoolsCollection () {
  return getCollection('School')
}

function toObjectId (value) {
  if (value instanceof ObjectId) {
    return value
  }
  if (typeof value === 'string' && ObjectId.isValid(value)) {
    return new ObjectId(value)
  }
  return null
}

function idsMatch (left, right) {
  const leftId = toObjectId(left)
  const rightId = toObjectId(right)

  if (!leftId || !rightId) {
    return false
  }

  return leftId.equals(rightId)
}

async function findByIdOrName (collection, value) {
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

async function getUniversity (university) {
  return findByIdOrName(universitiesCollection(), university)
}

async function getFaculty (faculty) {
  return findByIdOrName(facultiesCollection(), faculty)
}

async function getSchool (school) {
  return findByIdOrName(schoolsCollection(), school)
}

async function isFacultyInUniversity (faculty, university) {
  const facultyDocument = await getFaculty(faculty)
  const universityDocument = await getUniversity(university)

  if (!facultyDocument || !universityDocument) {
    return false
  }

  return idsMatch(facultyDocument.universityID, universityDocument._id)
}

async function isSchoolInFaculty (school, faculty) {
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

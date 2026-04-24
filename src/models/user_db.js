const { getCollection } = require('./db')

const USER_COLLECTION_NAME = 'User'

const usersCollection = function () {
  return getCollection(USER_COLLECTION_NAME)
}

/**
 * Returns the user document for a username.
 * @param {string} username - Username to search for.
 * @returns {Promise<object|null>} The matching user or null.
 */
const getUser = async function (username) {
  return usersCollection().findOne({ username })
}

/**
 * Inserts a new user document.
 * @param {object} user - User document to insert.
 * @returns {Promise<import('mongodb').InsertOneResult>} MongoDB insert result.
 */
const addUser = async function (user) {
  return usersCollection().insertOne(user)
}

/**
 * Deletes a user document by username.
 * @param {string} username - Username to delete.
 * @returns {Promise<import('mongodb').DeleteResult>} MongoDB delete result.
 */
const deleteUser = async function (username) {
  return usersCollection().deleteOne({ username })
}

/**
 * Searches for lecturer documents within a university, optionally filtering by name, faculty, and school.
 * @param {object} options - Search options.
 * @param {string} options.universityId - University to scope the search to.
 * @param {string} [options.query=''] - Name or username substring to match (case-insensitive).
 * @param {string} [options.facultyId=''] - Faculty to filter by.
 * @param {string} [options.schoolId=''] - School to filter by.
 * @returns {Promise<object[]>} Array of matching lecturer documents.
 */
const searchLecturers = async function ({ universityId, query = '', facultyId = '', schoolId = '' }) {
  const filter = {
    role: 'lecturer',
    universityId
  }

  if (facultyId) filter.facultyId = facultyId
  if (schoolId) filter.schoolId = schoolId

  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]}\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')
    filter.$or = [
      { username: regex },
      { firstName: regex },
      { lastName: regex }
    ]
  }

  return usersCollection().find(filter).toArray()
}

module.exports = {
  addUser,
  deleteUser,
  getUser,
  searchLecturers
}

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
 * Updates a user's institution fields by username.
 * @param {string} username - Username to update.
 * @param {object} institutions - Institution fields to store.
 * @param {string} institutions.universityId - Updated university value.
 * @param {string} institutions.facultyId - Updated faculty value.
 * @param {string} institutions.schoolId - Updated school value.
 * @returns {Promise<import('mongodb').UpdateResult>} MongoDB update result.
 */
const updateUserInstitutions = async function (username, {
  universityId,
  facultyId,
  schoolId
}) {
  return usersCollection().updateOne(
    { username },
    {
      $set: {
        universityId,
        facultyId,
        schoolId
      }
    }
  )
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
 * Returns the user document matching a Google account ID.
 * @param {string} googleId - Google account ID to search for.
 * @returns {Promise<object|null>} The matching user or null.
 */
const getUserByGoogleId = async function (googleId) {
  return usersCollection().findOne({ googleId })
}

/**
 * Returns the user document matching an email address.
 * @param {string} email - Email address to search for.
 * @returns {Promise<object|null>} The matching user or null.
 */
const getUserByEmail = async function (email) {
  return usersCollection().findOne({ email })
}

/**
 * Sets the googleId field on a user document identified by username.
 * @param {string} username - Username of the user to update.
 * @param {string} googleId - Google account ID to store.
 * @returns {Promise<import('mongodb').UpdateResult>} MongoDB update result.
 */
const linkGoogleId = async function (username, googleId) {
  return usersCollection().updateOne(
    { username },
    { $set: { googleId } }
  )
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
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escape(query), 'i')
    const conditions = [
      { username: regex },
      { firstName: regex },
      { lastName: regex }
    ]

    const parts = query.trim().split(/\s+/)
    if (parts.length >= 2) {
      const firstRegex = new RegExp(escape(parts[0]), 'i')
      const lastRegex = new RegExp(escape(parts.slice(1).join(' ')), 'i')
      conditions.push(
        { firstName: firstRegex, lastName: lastRegex },
        { firstName: lastRegex, lastName: firstRegex }
      )
    }

    filter.$or = conditions
  }

  return usersCollection().find(filter).toArray()
}

/**
 * Returns lecturer documents for the supplied usernames, preserving the request order.
 * @param {Array<string>} usernames - Lecturer usernames to load.
 * @param {string} [universityId=''] - Optional university to scope the lookup.
 * @returns {Promise<object[]>} Matching lecturer documents in the same order as the usernames.
 */
const getLecturersByUsernames = async function (usernames, universityId = '') {
  const lecturerUsernames = [...new Set((Array.isArray(usernames) ? usernames : []).filter(Boolean))]

  if (lecturerUsernames.length === 0) {
    return []
  }

  const filter = {
    role: 'lecturer',
    username: { $in: lecturerUsernames }
  }

  if (universityId) {
    filter.universityId = universityId
  }

  const lecturers = await usersCollection().find(filter).toArray()
  const lecturersByUsername = new Map(lecturers.map(function (lecturer) {
    return [lecturer.username, lecturer]
  }))

  return lecturerUsernames.map(function (username) {
    return lecturersByUsername.get(username)
  }).filter(Boolean)
}

/**
 * Adds a lecturer to the student's followed lecturers list.
 * Uses $addToSet so repeated follow requests stay idempotent.
 * @param {string} studentUsername - Username of the student doing the following.
 * @param {string} lecturerUsername - Username of the lecturer being followed.
 * @returns {Promise<import('mongodb').UpdateResult>} MongoDB update result.
 */
const followLecturer = async function (studentUsername, lecturerUsername) {
  return usersCollection().updateOne(
    { username: studentUsername, role: 'student' },
    { $addToSet: { followedLecturers: lecturerUsername } }
  )
}

module.exports = {
  addUser,
  deleteUser,
  followLecturer,
  getLecturersByUsernames,
  getUser,
  getUserByEmail,
  getUserByGoogleId,
  linkGoogleId,
  searchLecturers,
  updateUserInstitutions
}

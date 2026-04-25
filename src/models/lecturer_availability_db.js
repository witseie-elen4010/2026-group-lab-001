const { getCollection } = require('./db')

const COLLECTION = 'LecturerAvailability'

/**
 * Retrieves the consultation availability settings for a lecturer.
 * @param {string} username - The lecturer's username.
 * @returns {Promise<object|null>} The availability document, or null if not set.
 */
const getLecturerAvailability = async function (username) {
  const collection = await getCollection(COLLECTION)
  return collection.findOne({ username })
}

/**
 * Creates or updates the consultation availability settings for a lecturer.
 * @param {string} username - The lecturer's username.
 * @param {object} preferences - The consultation preference values.
 * @param {number} preferences.minStudents - Minimum students per consultation.
 * @param {number} preferences.maxStudents - Maximum students per consultation.
 * @param {number} preferences.duration - Duration of each consultation in minutes.
 * @param {number} preferences.dailyMax - Maximum number of consultations per day.
 * @returns {Promise<void>}
 */
const setLecturerAvailability = async function (username, { minStudents, maxStudents, duration, dailyMax }) {
  const collection = await getCollection(COLLECTION)
  await collection.updateOne(
    { username },
    { $set: { username, minStudents, maxStudents, duration, dailyMax } },
    { upsert: true }
  )
}

module.exports = { getLecturerAvailability, setLecturerAvailability }

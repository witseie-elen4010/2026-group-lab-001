const { getCollection } = require('./db')

const COLLECTION = 'LecturerAvailability'

/**
 * Retrieves the consultation availability settings for a lecturer.
 * The returned document may include:
 * - `minStudents`, `maxStudents`, `duration`, `dailyMax`
 * - `weeklyAvailability`: array of objects describing weekly slots (e.g. `{ day: 'monday', startTime: '09:00', endTime: '17:00' }`)
 * - `exceptionDates`: array of ISO date strings where the lecturer is unavailable
 * @param {string} username - The lecturer's username.
 * @returns {Promise<object|null>} The availability document, or null if not set.
 */
const getLecturerAvailability = async function (username) {
  const collection = await getCollection(COLLECTION)
  return collection.findOne({ username })
}

/**
 * Creates or updates the consultation availability settings for a lecturer.
 * Only fields provided in `preferences` will be upserted, preserving existing values for omitted keys.
 * @param {string} username - The lecturer's username.
 * @param {object} preferences - The consultation preference values.
 * @param {number} [preferences.minStudents] - Minimum students per consultation.
 * @param {number} [preferences.maxStudents] - Maximum students per consultation.
 * @param {number} [preferences.duration] - Duration of each consultation in minutes.
 * @param {number} [preferences.dailyMax] - Maximum number of consultations per day.
 * @param {Array<object>} [preferences.weeklyAvailability] - Weekly availability entries.
 * @param {Array<string>} [preferences.exceptionDates] - Specific non-repeating unavailable dates (ISO strings).
 * @returns {Promise<void>}
 */
const setLecturerAvailability = async function (username, preferences = {}) {
  const collection = await getCollection(COLLECTION)
  const {
    minStudents,
    maxStudents,
    duration,
    dailyMax,
    weeklyAvailability,
    exceptionDates
  } = preferences

  const setFields = { username }

  if (typeof minStudents !== 'undefined') setFields.minStudents = minStudents
  if (typeof maxStudents !== 'undefined') setFields.maxStudents = maxStudents
  if (typeof duration !== 'undefined') setFields.duration = duration
  if (typeof dailyMax !== 'undefined') setFields.dailyMax = dailyMax
  if (typeof weeklyAvailability !== 'undefined') setFields.weeklyAvailability = weeklyAvailability
  if (typeof exceptionDates !== 'undefined') setFields.exceptionDates = exceptionDates

  await collection.updateOne(
    { username },
    { $set: setFields },
    { upsert: true }
  )
}

module.exports = { getLecturerAvailability, setLecturerAvailability }

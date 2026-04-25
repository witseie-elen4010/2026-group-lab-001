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
const isValidWeekday = function (day) {
  if (!day || typeof day !== 'string') return false
  const allowed = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  return allowed.includes(day.toLowerCase())
}

const isValidTime = function (timeStr) {
  if (typeof timeStr !== 'string') return false
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)
}

const timeToMinutes = function (timeStr) {
  const parts = timeStr.split(':').map(Number)
  return parts[0] * 60 + parts[1]
}

const validatePreferences = function (prefs) {
  if (typeof prefs !== 'object' || prefs === null) throw new Error('preferences must be an object')

  const { minStudents, maxStudents, duration, dailyMax, weeklyAvailability, exceptionDates } = prefs

  if (typeof minStudents !== 'undefined' && (!Number.isInteger(minStudents) || minStudents < 0)) {
    throw new Error('minStudents must be a non-negative integer')
  }

  if (typeof maxStudents !== 'undefined' && (!Number.isInteger(maxStudents) || maxStudents < 0)) {
    throw new Error('maxStudents must be a non-negative integer')
  }

  if (typeof minStudents !== 'undefined' && typeof maxStudents !== 'undefined' && minStudents > maxStudents) {
    throw new Error('minStudents cannot be greater than maxStudents')
  }

  if (typeof duration !== 'undefined' && (!Number.isInteger(duration) || duration <= 0)) {
    throw new Error('duration must be a positive integer (minutes)')
  }

  if (typeof dailyMax !== 'undefined' && (!Number.isInteger(dailyMax) || dailyMax < 0)) {
    throw new Error('dailyMax must be a non-negative integer')
  }

  if (typeof weeklyAvailability !== 'undefined') {
    if (!Array.isArray(weeklyAvailability)) throw new Error('weeklyAvailability must be an array')
    weeklyAvailability.forEach(function (entry) {
      if (!entry || typeof entry !== 'object') throw new Error('weeklyAvailability entries must be objects')
      const { day, startTime, endTime } = entry
      if (!isValidWeekday(day)) throw new Error('weeklyAvailability day is invalid')
      if (!isValidTime(startTime) || !isValidTime(endTime)) throw new Error('startTime and endTime must be HH:MM')
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) throw new Error('startTime must be before endTime')
      if (typeof entry.minStudents !== 'undefined' && (!Number.isInteger(entry.minStudents) || entry.minStudents < 0)) {
        throw new Error('weeklyAvailability.minStudents must be a non-negative integer')
      }
      if (typeof entry.maxStudents !== 'undefined' && (!Number.isInteger(entry.maxStudents) || entry.maxStudents < 0)) {
        throw new Error('weeklyAvailability.maxStudents must be a non-negative integer')
      }
    })
  }

  if (typeof exceptionDates !== 'undefined') {
    if (!Array.isArray(exceptionDates)) throw new Error('exceptionDates must be an array')
    exceptionDates.forEach(function (d) {
      if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('exceptionDates must be ISO date strings YYYY-MM-DD')
    })
  }
}

const setLecturerAvailability = async function (username, preferences = {}) {
  validatePreferences(preferences)

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

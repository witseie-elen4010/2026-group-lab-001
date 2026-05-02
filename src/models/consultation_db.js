const { ObjectId } = require('mongodb')
const { getCollection } = require('./db')
const { addMinutesToTime } = require('../services/consultation_availability_validation')

const COLLECTION_NAME = 'Consultation'
const USER_COLLECTION_NAME = 'User'
const AVAILABILITY_COLLECTION_NAME = 'LecturerAvailability'

const consultationsCollection = function () {
  return getCollection(COLLECTION_NAME)
}

const usersCollection = function () {
  return getCollection(USER_COLLECTION_NAME)
}

const JOIN_RESULT_REASONS = {
  ALREADY_JOINED: 'already-joined',
  FULL: 'full',
  NOT_FOUND: 'not-found'
}

const buildDisplayName = function (user, fallback) {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
  return fullName || fallback || ''
}

/**
 * Inserts a new consultation document.
 * @param {object} consultation - Consultation document to insert.
 * @returns {Promise<import('mongodb').InsertOneResult>} MongoDB insert result.
 */
const addConsultation = async function (consultation) {
  return consultationsCollection().insertOne(consultation)
}

/**
 * Returns consultations for a lecturer on a specific date.
 * @param {string} lecturerId - Lecturer username.
 * @param {string} isoDate - Date in YYYY-MM-DD format.
 * @returns {Promise<Array<object>>} Matching consultation documents.
 */
const listConsultationsForLecturerOnDate = async function (lecturerId, isoDate) {
  return consultationsCollection().find({
    lecturerId,
    datetime: {
      $gte: `${isoDate}T00:00`,
      $lt: `${isoDate}T23:59~`
    }
  }).toArray()
}

/**
 * Searches consultations for display on the join page.
 * @param {object} options - Search options.
 * @param {string} [options.username=''] - Current student username.
 * @param {string} [options.lecturerId=''] - Filter by lecturer username.
 * @param {string} [options.date=''] - Filter by date in YYYY-MM-DD format.
 * @param {string} [options.time=''] - Filter by exact start time in HH:MM format; requires date.
 * @returns {Promise<Array<object>>} Matching consultations enriched for display.
 */
const searchConsultationsForStudent = async function ({
  username = '',
  lecturerId = '',
  date = '',
  time = ''
} = {}) {
  const query = {}
  if (lecturerId) query.lecturerId = lecturerId
  if (date && time) {
    query.datetime = `${date}T${time}`
  } else if (date) {
    query.datetime = { $gte: `${date}T00:00`, $lt: `${date}T23:59~` }
  }
  const consultations = await consultationsCollection().find(query).toArray()

  if (consultations.length === 0) {
    return []
  }

  const userIds = [...new Set(consultations.flatMap(function (consultation) {
    return [consultation.lecturerId, consultation.organiserId]
  }).filter(Boolean))]
  const lecturerIds = [...new Set(consultations.map(function (consultation) {
    return consultation.lecturerId
  }).filter(Boolean))]

  const [users, availabilities] = await Promise.all([
    usersCollection().find({ username: { $in: userIds } }).toArray(),
    getCollection(AVAILABILITY_COLLECTION_NAME).find({ username: { $in: lecturerIds } }).toArray()
  ])

  const usersByUsername = new Map(users.map(function (user) {
    return [user.username, user]
  }))
  const availabilitiesByUsername = new Map(availabilities.map(function (availability) {
    return [availability.username, availability]
  }))

  return consultations.map(function (consultation) {
    const lecturerUser = usersByUsername.get(consultation.lecturerId)
    const attendees = Array.isArray(consultation.attendees) ? consultation.attendees : []
    const hasCapacity = Number.isInteger(consultation.capacity)
    const isInFuture = new Date(consultation.datetime) > new Date()
    const startTime = consultation.datetime?.slice(11, 16) || ''
    const endTime = addMinutesToTime(startTime, availabilitiesByUsername.get(consultation.lecturerId)?.duration) || startTime
    const time = startTime ? `${startTime} to ${endTime}` : ''

    if (!consultation._id) {
      return null
    }

    if (!isInFuture) {
      return null
    }

    const hasJoined = attendees.includes(username)

    return {
      attendeesCount: attendees.length,
      canJoin: isInFuture && !hasJoined && (!hasCapacity || attendees.length < consultation.capacity),
      capacity: hasCapacity ? consultation.capacity : attendees.length,
      date: consultation.datetime?.slice(0, 10) || '',
      hasJoined,
      id: consultation._id.toString(),
      lecturer: buildDisplayName(lecturerUser, consultation.lecturerId),
      name: consultation.title || 'Untitled consultation',
      organiser: buildDisplayName(usersByUsername.get(consultation.organiserId), consultation.organiserId),
      time
    }
  }).filter(Boolean)
}

/**
 * Adds a student attendee to an existing consultation when space remains.
 * @param {string} consultationId - Consultation id string.
 * @param {string} username - Student username.
 * @returns {Promise<{success: boolean, reason?: string, statusCode?: number}>} Join result.
 */
const addStudentToConsultation = async function (consultationId, username) {
  if (!ObjectId.isValid(consultationId)) {
    return { success: false, reason: JOIN_RESULT_REASONS.NOT_FOUND, statusCode: 404 }
  }

  const objectId = new ObjectId(consultationId)
  const consultation = await consultationsCollection().findOne({ _id: objectId })

  if (!consultation) {
    return { success: false, reason: JOIN_RESULT_REASONS.NOT_FOUND, statusCode: 404 }
  }

  const attendees = Array.isArray(consultation.attendees) ? consultation.attendees : []
  if (attendees.includes(username)) {
    return { success: false, reason: JOIN_RESULT_REASONS.ALREADY_JOINED, statusCode: 400 }
  }

  if (Number.isInteger(consultation.capacity) && attendees.length >= consultation.capacity) {
    return { success: false, reason: JOIN_RESULT_REASONS.FULL, statusCode: 400 }
  }

  await consultationsCollection().updateOne(
    { _id: objectId },
    { $addToSet: { attendees: username } }
  )

  return { success: true }
}

module.exports = {
  addConsultation,
  addStudentToConsultation,
  JOIN_RESULT_REASONS,
  listConsultationsForLecturerOnDate,
  searchConsultationsForStudent
}

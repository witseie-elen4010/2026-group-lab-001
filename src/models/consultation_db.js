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

const buildAttendeeRoster = function (attendees, usersByUsername) {
  if (!Array.isArray(attendees) || attendees.length === 0) {
    return []
  }

  return attendees.map(function (username) {
    return buildDisplayName(usersByUsername.get(username), username)
  })
}

const buildConsultationTime = function (datetime, duration) {
  const startTime = datetime?.slice(11, 16) || ''

  if (!startTime) {
    return ''
  }

  if (!duration) {
    return startTime
  }

  const endTime = addMinutesToTime(startTime, duration) || startTime

  return endTime === startTime ? startTime : `${startTime} to ${endTime}`
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
 * Returns all upcoming consultations for a lecturer, enriched for dashboard display.
 * @param {string} lecturerId - Lecturer username.
 * @returns {Promise<Array<object>>} Upcoming consultations sorted by date and time.
 */
const getUpcomingConsultationsForLecturer = async function (lecturerId) {
  const consultations = await consultationsCollection().find({ lecturerId }).toArray()

  if (consultations.length === 0) {
    return []
  }

  const userIds = [...new Set(consultations.flatMap(function (consultation) {
    const attendees = Array.isArray(consultation.attendees) ? consultation.attendees : []

    return [consultation.organiserId, ...attendees]
  }).filter(Boolean))]

  const [users, availabilities] = await Promise.all([
    usersCollection().find({ username: { $in: userIds } }).toArray(),
    getCollection(AVAILABILITY_COLLECTION_NAME).find({ username: lecturerId }).toArray()
  ])

  const usersByUsername = new Map(users.map(function (user) {
    return [user.username, user]
  }))
  const lecturerAvailability = availabilities[0] || null
  const now = new Date()

  return consultations.filter(function (consultation) {
    return consultation?._id && new Date(consultation.datetime) > now
  }).sort(function (left, right) {
    return (left.datetime || '').localeCompare(right.datetime || '')
  }).map(function (consultation) {
    return {
      date: consultation.datetime?.slice(0, 10) || '',
      id: consultation._id.toString(),
      name: consultation.title || 'Untitled consultation',
      organiser: buildDisplayName(usersByUsername.get(consultation.organiserId), consultation.organiserId),
      roster: buildAttendeeRoster(consultation.attendees, usersByUsername),
      time: buildConsultationTime(consultation.datetime, lecturerAvailability?.duration)
    }
  })
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
    const time = buildConsultationTime(consultation.datetime, availabilitiesByUsername.get(consultation.lecturerId)?.duration)

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
 * Returns upcoming consultations within a month range for display on the student calendar.
 * Excludes past consultations. Each entry includes the student's join status and whether the consultation is full.
 * @param {string} username - The student's username.
 * @param {string} monthStart - Start of the month range in 'YYYY-MM-DDTHH:MM' format.
 * @param {string} monthEnd - End of the month range in 'YYYY-MM-DDTHH:MM~' format.
 * @returns {Promise<Array<object>>} Enriched consultation objects for calendar display.
 */
const getConsultationsForCalendar = async function (username, monthStart, monthEnd) {
  const consultations = await consultationsCollection().find({
    datetime: { $gte: monthStart, $lt: monthEnd }
  }).toArray()

  if (consultations.length === 0) return []

  const lecturerIds = [...new Set(consultations.map(function (c) {
    return c.lecturerId
  }).filter(Boolean))]

  const [users, availabilities] = await Promise.all([
    usersCollection().find({ username: { $in: lecturerIds } }).toArray(),
    getCollection(AVAILABILITY_COLLECTION_NAME).find({ username: { $in: lecturerIds } }).toArray()
  ])

  const usersByUsername = new Map(users.map(function (u) {
    return [u.username, u]
  }))
  const availabilitiesByUsername = new Map(availabilities.map(function (a) {
    return [a.username, a]
  }))

  const now = new Date()

  return consultations.map(function (consultation) {
    if (!consultation._id) return null
    if (new Date(consultation.datetime) <= now) return null

    const time = buildConsultationTime(consultation.datetime, availabilitiesByUsername.get(consultation.lecturerId)?.duration)
    const attendees = Array.isArray(consultation.attendees) ? consultation.attendees : []
    const hasCapacity = Number.isInteger(consultation.capacity)

    return {
      date: consultation.datetime?.slice(0, 10) || '',
      hasJoined: attendees.includes(username),
      id: consultation._id.toString(),
      isFull: hasCapacity && attendees.length >= consultation.capacity,
      lecturer: buildDisplayName(usersByUsername.get(consultation.lecturerId), consultation.lecturerId),
      name: consultation.title || 'Untitled consultation',
      time
    }
  }).filter(Boolean)
}

const CANCEL_RESULT_REASONS = {
  NOT_FOUND: 'not-found',
  NOT_LECTURER: 'not-lecturer',
  NOT_ORGANISER: 'not-organiser',
  PAST_CONSULTATION: 'past-consultation'
}

/**
 * Returns upcoming consultations for a student, with an isOrganiser flag for each.
 * @param {string} username - Student username.
 * @returns {Promise<Array<object>>} Upcoming consultations sorted by datetime ascending.
 */
const getConsultationsForStudent = async function (username) {
  const consultations = await consultationsCollection().find({ attendees: username }).toArray()
  if (consultations.length === 0) return []

  const now = new Date()
  const upcoming = consultations.filter(function (c) {
    return c._id && new Date(c.datetime) > now
  })

  if (upcoming.length === 0) return []

  const lecturerIds = [...new Set(upcoming.map(function (c) { return c.lecturerId }).filter(Boolean))]
  const [users, availabilities] = await Promise.all([
    usersCollection().find({ username: { $in: lecturerIds } }).toArray(),
    getCollection(AVAILABILITY_COLLECTION_NAME).find({ username: { $in: lecturerIds } }).toArray()
  ])

  const usersByUsername = new Map(users.map(function (u) { return [u.username, u] }))
  const availabilitiesByUsername = new Map(availabilities.map(function (a) { return [a.username, a] }))

  return upcoming.sort(function (a, b) {
    return (a.datetime || '').localeCompare(b.datetime || '')
  }).map(function (consultation) {
    return {
      date: consultation.datetime?.slice(0, 10) || '',
      id: consultation._id.toString(),
      isOrganiser: consultation.organiserId === username,
      lecturer: buildDisplayName(usersByUsername.get(consultation.lecturerId), consultation.lecturerId),
      name: consultation.title || 'Untitled consultation',
      time: buildConsultationTime(consultation.datetime, availabilitiesByUsername.get(consultation.lecturerId)?.duration)
    }
  })
}

/**
 * Deletes a future consultation if the requesting user owns it.
 * Students and admins must be the organiser; lecturers must be the assigned lecturer.
 * @param {string} consultationId - Consultation id string.
 * @param {string} userId - Username of the requester.
 * @param {string} role - Role of the requester ('lecturer' | 'student' | 'admin').
 * @returns {Promise<{success: boolean, statusCode?: number, reason?: string}>} Cancel result.
 */
const cancelConsultation = async function (consultationId, userId, role) {
  if (!ObjectId.isValid(consultationId)) {
    return { success: false, statusCode: 404, reason: CANCEL_RESULT_REASONS.NOT_FOUND }
  }

  const objectId = new ObjectId(consultationId)
  const consultation = await consultationsCollection().findOne({ _id: objectId })

  if (!consultation) {
    return { success: false, statusCode: 404, reason: CANCEL_RESULT_REASONS.NOT_FOUND }
  }

  if (role === 'lecturer') {
    if (consultation.lecturerId !== userId) {
      return { success: false, statusCode: 403, reason: CANCEL_RESULT_REASONS.NOT_LECTURER }
    }
  } else if (consultation.organiserId !== userId) {
    return { success: false, statusCode: 403, reason: CANCEL_RESULT_REASONS.NOT_ORGANISER }
  }

  if (new Date(consultation.datetime) <= new Date()) {
    return { success: false, statusCode: 400, reason: CANCEL_RESULT_REASONS.PAST_CONSULTATION }
  }

  await consultationsCollection().deleteOne({ _id: objectId })
  return { success: true }
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
  cancelConsultation,
  CANCEL_RESULT_REASONS,
  getConsultationsForCalendar,
  getConsultationsForStudent,
  getUpcomingConsultationsForLecturer,
  JOIN_RESULT_REASONS,
  listConsultationsForLecturerOnDate,
  searchConsultationsForStudent
}

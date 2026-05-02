const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Converts a HH:MM time string to minutes after midnight.
 * @param {string} timeString - Time string in HH:MM format.
 * @returns {number} Minutes after midnight.
 */
const timeToMinutes = function (timeString) {
  const [hours, minutes] = timeString.split(':').map(Number)
  return (hours * 60) + minutes
}

/**
 * Adds minutes to a HH:MM time string.
 * @param {string} timeString - Time string in HH:MM format.
 * @param {number} minutesToAdd - Number of minutes to add.
 * @returns {string} The resulting HH:MM time, or an empty string when invalid.
 */
const addMinutesToTime = function (timeString, minutesToAdd) {
  if (!TIME_PATTERN.test(timeString) || !Number.isInteger(minutesToAdd) || minutesToAdd <= 0) {
    return ''
  }

  const totalMinutes = timeToMinutes(timeString) + minutesToAdd
  if (totalMinutes >= (24 * 60)) {
    return ''
  }

  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const minutes = String(totalMinutes % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Returns the weekday key for a YYYY-MM-DD date string.
 * @param {string} isoDate - Date string.
 * @returns {string} Lower-case weekday key, or an empty string.
 */
const getWeekdayFromIso = function (isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return WEEKDAYS[date.getUTCDay()]
}

/**
 * Validates a requested consultation against a lecturer's saved availability.
 * @param {object} options - Validation options.
 * @param {object|null} options.availability - Lecturer availability document.
 * @param {string} options.date - Requested date in YYYY-MM-DD format.
 * @param {string} options.startTime - Requested start time in HH:MM format.
 * @param {string} options.endTime - Requested end time in HH:MM format.
 * @param {Array<object>} [options.scheduledConsultations=[]] - Existing same-day consultations.
 * @returns {{isValid: boolean, error: string}} Validation result.
 */
const validateLecturerAvailability = function ({
  availability,
  date,
  endTime,
  scheduledConsultations = [],
  startTime
}) {
  if (!availability) {
    return { isValid: false, error: 'This lecturer has not set consultation availability yet.' }
  }

  if (Array.isArray(availability.exceptionDates) && availability.exceptionDates.includes(date)) {
    return { isValid: false, error: 'This lecturer is unavailable on the selected date.' }
  }

  const weekday = getWeekdayFromIso(date)
  if (!weekday) {
    return { isValid: false, error: 'Invalid date.' }
  }

  const weeklyAvailability = Array.isArray(availability.weeklyAvailability) ? availability.weeklyAvailability : []
  const matchingSlot = weeklyAvailability.find(function (slot) {
    return slot && typeof slot === 'object' && (slot.day || '').toLowerCase() === weekday
  })

  if (!matchingSlot || !TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime) || !TIME_PATTERN.test(matchingSlot.startTime) || !TIME_PATTERN.test(matchingSlot.endTime)) {
    return { isValid: false, error: 'The selected time is outside this lecturer\'s consultation availability.' }
  }

  const requestedStart = timeToMinutes(startTime)
  const requestedEnd = timeToMinutes(endTime)
  const slotStart = timeToMinutes(matchingSlot.startTime)
  const slotEnd = timeToMinutes(matchingSlot.endTime)

  if (requestedStart >= requestedEnd || requestedStart < slotStart || requestedEnd > slotEnd) {
    return { isValid: false, error: 'The selected time is outside this lecturer\'s consultation availability.' }
  }

  if (Number.isInteger(availability.dailyMax) && availability.dailyMax >= 0 && scheduledConsultations.length >= availability.dailyMax) {
    return { isValid: false, error: 'This lecturer has reached their consultation limit for the selected date.' }
  }

  return { isValid: true, error: '' }
}

/**
 * Finds a scheduled consultation that overlaps a proposed start time using the lecturer's duration.
 * Cancelled consultations are ignored.
 * Back-to-back (end == start) is not considered an overlap.
 * @param {object} options
 * @param {Array<object>} [options.scheduledConsultations=[]]
 * @param {string} options.proposedStart - HH:MM format
 * @param {number} options.duration - Duration in minutes
 * @returns {object|null} The conflicting consultation document, or null when none found.
 */
const findOverlappingConsultation = function ({ scheduledConsultations = [], proposedStart, duration }) {
  if (!Array.isArray(scheduledConsultations) || !TIME_PATTERN.test(proposedStart) || !Number.isInteger(duration) || duration <= 0) {
    return null
  }

  const proposedEnd = addMinutesToTime(proposedStart, duration)
  if (!proposedEnd) {
    return null
  }

  const proposedStartMins = timeToMinutes(proposedStart)
  const proposedEndMins = timeToMinutes(proposedEnd)

  for (let i = 0; i < scheduledConsultations.length; i++) {
    const sc = scheduledConsultations[i]
    if (!sc || !sc.datetime) continue

    // ignore explicitly cancelled consultations
    if (sc.cancelled === true) continue
    if (sc.status && typeof sc.status === 'string' && sc.status.toLowerCase() === 'cancelled') continue

    // datetime expected as 'YYYY-MM-DDTHH:MM'
    const existingStart = (typeof sc.datetime === 'string' && sc.datetime.length >= 16) ? sc.datetime.slice(11, 16) : ''
    if (!TIME_PATTERN.test(existingStart)) continue

    const existingEnd = addMinutesToTime(existingStart, duration)
    if (!existingEnd) continue

    const existingStartMins = timeToMinutes(existingStart)
    const existingEndMins = timeToMinutes(existingEnd)

    // overlap when existingStart < proposedEnd AND existingEnd > proposedStart
    if (existingStartMins < proposedEndMins && existingEndMins > proposedStartMins) {
      return sc
    }
  }

  return null
}

const isDateAvailableForLecturer = function (availability, date, time) {
  if (!availability) return false
  if (Array.isArray(availability.exceptionDates) && availability.exceptionDates.includes(date)) return false
  const weekday = getWeekdayFromIso(date)
  if (!weekday) return false
  const weeklyAvailability = Array.isArray(availability.weeklyAvailability) ? availability.weeklyAvailability : []
  const matchingSlot = weeklyAvailability.find(function (slot) {
    return slot && typeof slot === 'object' && (slot.day || '').toLowerCase() === weekday
  })
  if (!matchingSlot) return false
  if (!TIME_PATTERN.test(time) || !TIME_PATTERN.test(matchingSlot.startTime) || !TIME_PATTERN.test(matchingSlot.endTime)) {
    return true
  }
  const duration = Number.isInteger(availability.duration) ? availability.duration : 60
  const consultationEnd = addMinutesToTime(time, duration)
  if (!consultationEnd) return false
  return timeToMinutes(time) >= timeToMinutes(matchingSlot.startTime) &&
    timeToMinutes(consultationEnd) <= timeToMinutes(matchingSlot.endTime)
}

module.exports = {
  addMinutesToTime,
  findOverlappingConsultation,
  getWeekdayFromIso,
  isDateAvailableForLecturer,
  validateLecturerAvailability
}

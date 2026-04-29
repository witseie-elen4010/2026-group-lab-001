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

module.exports = {
  addMinutesToTime,
  validateLecturerAvailability
}

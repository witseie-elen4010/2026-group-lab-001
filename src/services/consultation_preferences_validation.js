const MAX_DAILY_CONSULTATION_MINUTES = 480

/**
 * Validates a lecturer's consultation preference settings.
 * Rejects negative values, a min/max student inversion, and a total daily
 * consultation time that exceeds the maximum availability of 480 minutes.
 * @param {object} preferences - The consultation preference values to validate.
 * @param {number} preferences.minStudents - Minimum students per consultation.
 * @param {number} preferences.maxStudents - Maximum students per consultation.
 * @param {number} preferences.duration - Duration of each consultation in minutes.
 * @param {number} preferences.dailyMax - Maximum number of consultations per day.
 * @returns {{isValid: boolean, error: string}} Validation result with an error message if invalid.
 */
const validateConsultationPreferences = function ({ minStudents, maxStudents, duration, dailyMax }) {
  if (minStudents < 0 || maxStudents < 0 || duration < 0 || dailyMax < 0) {
    return { isValid: false, error: 'Consultation settings cannot be negative.' }
  }
  if (minStudents > maxStudents) {
    return { isValid: false, error: 'Minimum students cannot exceed maximum students.' }
  }
  if (duration * dailyMax > MAX_DAILY_CONSULTATION_MINUTES) {
    return { isValid: false, error: `Total daily consultation time (${duration * dailyMax} min) exceeds your availability of ${MAX_DAILY_CONSULTATION_MINUTES} minutes.` }
  }
  return { isValid: true, error: '' }
}

module.exports = { validateConsultationPreferences }

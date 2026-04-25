const MAX_DAILY_CONSULTATION_MINUTES = 480

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

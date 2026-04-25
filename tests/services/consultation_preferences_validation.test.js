const { validateConsultationPreferences } = require('../../src/services/consultation_preferences_validation')

describe('consultation preferences validation', () => {
  test('Returns invalid when minStudents is negative', () => {
    expect(validateConsultationPreferences({ minStudents: -1, maxStudents: 10, duration: 60, dailyMax: 4 }))
      .toEqual({ isValid: false, error: 'Consultation settings cannot be negative.' })
  })

  test('Returns invalid when maxStudents is negative', () => {
    expect(validateConsultationPreferences({ minStudents: 2, maxStudents: -1, duration: 60, dailyMax: 4 }))
      .toEqual({ isValid: false, error: 'Consultation settings cannot be negative.' })
  })

  test('Returns invalid when duration is negative', () => {
    expect(validateConsultationPreferences({ minStudents: 2, maxStudents: 10, duration: -1, dailyMax: 4 }))
      .toEqual({ isValid: false, error: 'Consultation settings cannot be negative.' })
  })

  test('Returns invalid when dailyMax is negative', () => {
    expect(validateConsultationPreferences({ minStudents: 2, maxStudents: 10, duration: 60, dailyMax: -1 }))
      .toEqual({ isValid: false, error: 'Consultation settings cannot be negative.' })
  })

  test('Returns invalid when minStudents exceeds maxStudents', () => {
    expect(validateConsultationPreferences({ minStudents: 10, maxStudents: 5, duration: 60, dailyMax: 4 }))
      .toEqual({ isValid: false, error: 'Minimum students cannot exceed maximum students.' })
  })

  test('Returns invalid when duration times dailyMax exceeds 480 minutes', () => {
    expect(validateConsultationPreferences({ minStudents: 2, maxStudents: 10, duration: 120, dailyMax: 5 }))
      .toEqual({ isValid: false, error: 'Total daily consultation time (600 min) exceeds your availability of 480 minutes.' })
  })

  test('Returns valid when minStudents equals maxStudents', () => {
    expect(validateConsultationPreferences({ minStudents: 5, maxStudents: 5, duration: 60, dailyMax: 4 }))
      .toEqual({ isValid: true, error: '' })
  })

  test('Returns valid when duration times dailyMax equals exactly 480 minutes', () => {
    expect(validateConsultationPreferences({ minStudents: 2, maxStudents: 10, duration: 60, dailyMax: 8 }))
      .toEqual({ isValid: true, error: '' })
  })

  test('Returns valid for a correct set of preferences', () => {
    expect(validateConsultationPreferences({ minStudents: 2, maxStudents: 10, duration: 60, dailyMax: 4 }))
      .toEqual({ isValid: true, error: '' })
  })
})

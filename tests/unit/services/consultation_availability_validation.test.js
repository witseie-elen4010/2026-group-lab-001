const {
  addMinutesToTime,
  validateLecturerAvailability
} = require('../../../src/services/consultation_availability_validation')

describe('consultation availability validation', () => {
  const baseAvailability = {
    dailyMax: 2,
    duration: 60,
    exceptionDates: [],
    weeklyAvailability: [{ day: 'monday', startTime: '08:00', endTime: '12:00' }]
  }

  test('adds minutes to a HH:MM string', () => {
    expect(addMinutesToTime('09:15', 45)).toBe('10:00')
  })

  test('returns invalid when lecturer availability is missing', () => {
    expect(validateLecturerAvailability({
      availability: null,
      date: '2026-05-04',
      endTime: '10:00',
      scheduledConsultations: [],
      startTime: '09:00'
    })).toEqual({
      error: 'This lecturer has not set consultation availability yet.',
      isValid: false
    })
  })

  test('returns invalid when the selected date is an exception date', () => {
    expect(validateLecturerAvailability({
      availability: { ...baseAvailability, exceptionDates: ['2026-05-04'] },
      date: '2026-05-04',
      endTime: '10:00',
      scheduledConsultations: [],
      startTime: '09:00'
    })).toEqual({
      error: 'This lecturer is unavailable on the selected date.',
      isValid: false
    })
  })

  test('returns invalid when the selected time is outside the weekly slot', () => {
    expect(validateLecturerAvailability({
      availability: baseAvailability,
      date: '2026-05-04',
      endTime: '12:30',
      scheduledConsultations: [],
      startTime: '11:30'
    })).toEqual({
      error: 'The selected time is outside this lecturer\'s consultation availability.',
      isValid: false
    })
  })

  test('returns invalid when the lecturer has reached the daily limit', () => {
    expect(validateLecturerAvailability({
      availability: baseAvailability,
      date: '2026-05-04',
      endTime: '11:00',
      scheduledConsultations: [{ datetime: '2026-05-04T08:00' }, { datetime: '2026-05-04T10:00' }],
      startTime: '10:00'
    })).toEqual({
      error: 'This lecturer has reached their consultation limit for the selected date.',
      isValid: false
    })
  })

  test('returns valid when the requested consultation fits lecturer availability', () => {
    expect(validateLecturerAvailability({
      availability: baseAvailability,
      date: '2026-05-04',
      endTime: '10:00',
      scheduledConsultations: [],
      startTime: '09:00'
    })).toEqual({
      error: '',
      isValid: true
    })
  })
})

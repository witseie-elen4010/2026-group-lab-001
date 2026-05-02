const {
  addMinutesToTime,
  getWeekdayFromIso,
  isDateAvailableForLecturer,
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

  const { findOverlappingConsultation } = require('../../../src/services/consultation_availability_validation')

  test('detects overlapping consultation when times overlap', () => {
    const scheduled = [{ datetime: '2026-05-04T10:00' }]

    const conflict = findOverlappingConsultation({
      scheduledConsultations: scheduled,
      proposedStart: '10:30',
      duration: 60
    })

    expect(conflict).toBe(scheduled[0])
  })

  test('allows back-to-back consultations when end equals start', () => {
    const scheduled = [{ datetime: '2026-05-04T10:00' }]

    const conflict = findOverlappingConsultation({
      scheduledConsultations: scheduled,
      proposedStart: '11:00',
      duration: 60
    })

    expect(conflict).toBeNull()
  })

  test('ignores cancelled consultations with boolean flag', () => {
    const scheduled = [{ datetime: '2026-05-04T10:00', cancelled: true }]

    const conflict = findOverlappingConsultation({
      scheduledConsultations: scheduled,
      proposedStart: '10:30',
      duration: 60
    })

    expect(conflict).toBeNull()
  })

  test('ignores cancelled consultations with status string', () => {
    const scheduled = [{ datetime: '2026-05-04T10:00', status: 'cancelled' }]

    const conflict = findOverlappingConsultation({
      scheduledConsultations: scheduled,
      proposedStart: '10:30',
      duration: 60
    })

    expect(conflict).toBeNull()
  })

  test('returns null for invalid inputs', () => {
    expect(findOverlappingConsultation({ scheduledConsultations: 'not-array', proposedStart: '10:00', duration: 60 })).toBeNull()
    expect(findOverlappingConsultation({ scheduledConsultations: [], proposedStart: '25:00', duration: 60 })).toBeNull()
    expect(findOverlappingConsultation({ scheduledConsultations: [], proposedStart: '10:00', duration: -5 })).toBeNull()
  })

  test('getWeekdayFromIso returns the weekday for a known Monday date', () => {
    expect(getWeekdayFromIso('2026-05-04')).toBe('monday')
  })

  test('getWeekdayFromIso returns the weekday for a known Sunday date', () => {
    expect(getWeekdayFromIso('2026-05-10')).toBe('sunday')
  })

  test('getWeekdayFromIso returns empty string for an invalid date', () => {
    expect(getWeekdayFromIso('not-a-date')).toBe('')
  })

  describe('isDateAvailableForLecturer', () => {
    const MONDAY_AVAILABILITY = {
      duration: 60,
      exceptionDates: [],
      weeklyAvailability: [{ day: 'monday', startTime: '08:00', endTime: '12:00' }]
    }
    const MONDAY = '2026-05-04'
    const TUESDAY = '2026-05-05'

    test('returns false when availability is null', () => {
      expect(isDateAvailableForLecturer(null, MONDAY, '')).toBe(false)
    })

    test('returns false when the date is an exception date', () => {
      expect(isDateAvailableForLecturer(
        { ...MONDAY_AVAILABILITY, exceptionDates: [MONDAY] },
        MONDAY,
        ''
      )).toBe(false)
    })

    test('returns false when the weekday is not in the weekly availability', () => {
      expect(isDateAvailableForLecturer(MONDAY_AVAILABILITY, TUESDAY, '')).toBe(false)
    })

    test('returns true when the date is available and no time is provided', () => {
      expect(isDateAvailableForLecturer(MONDAY_AVAILABILITY, MONDAY, '')).toBe(true)
    })

    test('returns true when the proposed time fits within the slot', () => {
      expect(isDateAvailableForLecturer(MONDAY_AVAILABILITY, MONDAY, '09:00')).toBe(true)
    })

    test('returns false when the proposed time is before the slot start', () => {
      expect(isDateAvailableForLecturer(MONDAY_AVAILABILITY, MONDAY, '07:00')).toBe(false)
    })

    test('returns false when the consultation would end after the slot end', () => {
      expect(isDateAvailableForLecturer(MONDAY_AVAILABILITY, MONDAY, '11:30')).toBe(false)
    })

    test('returns true when the consultation ends exactly at the slot end', () => {
      expect(isDateAvailableForLecturer(MONDAY_AVAILABILITY, MONDAY, '11:00')).toBe(true)
    })

    test('returns true when the time format is invalid, falling back to date-only check', () => {
      expect(isDateAvailableForLecturer(MONDAY_AVAILABILITY, MONDAY, 'badtime')).toBe(true)
    })

    test('defaults duration to 60 when not specified in availability', () => {
      const noDuration = { exceptionDates: [], weeklyAvailability: MONDAY_AVAILABILITY.weeklyAvailability }
      expect(isDateAvailableForLecturer(noDuration, MONDAY, '11:00')).toBe(true)
    })
  })
})

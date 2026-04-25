const { buildCurrentMonthCalendar } = require('../../src/utils/calendar')

/**
 * Finds the first day number in a month for the given weekday.
 * @param {number} year - Four-digit year.
 * @param {number} month - Zero-based month index.
 * @param {number} weekdayIndex - Sunday-based weekday index.
 * @returns {number} First matching day number.
 */
const findFirstDayNumberForWeekday = function (year, month, weekdayIndex) {
  let dayNumber = 1

  while (new Date(year, month, dayNumber).getMonth() === month) {
    if (new Date(year, month, dayNumber).getDay() === weekdayIndex) {
      return dayNumber
    }

    dayNumber += 1
  }

  return -1
}

/**
 * Builds a YYYY-MM-DD date string.
 * @param {number} year - Four-digit year.
 * @param {number} month - Zero-based month index.
 * @param {number} dayNumber - Day number in the month.
 * @returns {string} ISO date string.
 */
const buildIsoDate = function (year, month, dayNumber) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
}

const findCalendarDay = function (calendar, dayNumber) {
  return calendar.weeks.flat().find(function (day) {
    return day.dayNumber === dayNumber
  })
}

describe('calendar utility', () => {
  test('marks weekly availability days as available', function () {
    const year = 2026
    const month = 4
    const firstMonday = findFirstDayNumberForWeekday(year, month, 1)
    const calendar = buildCurrentMonthCalendar(new Date(year, month, 15), {
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }],
      exceptionDates: []
    })

    expect(findCalendarDay(calendar, firstMonday)).toEqual(expect.objectContaining({
      dayNumber: firstMonday,
      availabilityState: 'available',
      availabilityText: '09:00 - 12:00'
    }))
  })

  test('marks exception dates as unavailable even when the weekday is usually available', function () {
    const year = 2026
    const month = 4
    const firstMonday = findFirstDayNumberForWeekday(year, month, 1)
    const calendar = buildCurrentMonthCalendar(new Date(year, month, 15), {
      weeklyAvailability: [{ day: 'monday', startTime: '09:00', endTime: '12:00' }],
      exceptionDates: [buildIsoDate(year, month, firstMonday)]
    })

    expect(findCalendarDay(calendar, firstMonday)).toEqual(expect.objectContaining({
      dayNumber: firstMonday,
      availabilityState: 'unavailable',
      availabilityText: 'Unavailable'
    }))
  })
})

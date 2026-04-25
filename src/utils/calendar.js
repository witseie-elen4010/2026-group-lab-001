const DAY_LABELS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
const WEEKDAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])
const MONTH_LABELS = Object.freeze([
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
])

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

/**
 * Builds a calendar cell for an empty day slot.
 * @returns {{dayNumber: string, isoDate: string, isEmpty: boolean, availabilityState: string, availabilityText: string}} Empty calendar cell.
 */
const buildEmptyCalendarCell = function () {
  return {
    dayNumber: '',
    isoDate: '',
    isEmpty: true,
    availabilityState: 'empty',
    availabilityText: ''
  }
}

/**
 * Builds a calendar cell for a real day in the current month.
 * @param {number} year - Four-digit year.
 * @param {number} month - Zero-based month index.
 * @param {number} dayNumber - Day number in the month.
 * @param {Record<string, {startTime?: string, endTime?: string}>} weeklyAvailabilityByDay - Availability entries keyed by weekday.
 * @param {Set<string>} exceptionDateSet - Set of unavailable ISO date strings.
 * @returns {{dayNumber: number, isoDate: string, isEmpty: boolean, availabilityState: string, availabilityText: string}} Calendar cell.
 */
const buildCalendarDayCell = function (year, month, dayNumber, weeklyAvailabilityByDay, exceptionDateSet) {
  const isoDate = buildIsoDate(year, month, dayNumber)

  if (exceptionDateSet.has(isoDate)) {
    return {
      dayNumber,
      isoDate,
      isEmpty: false,
      availabilityState: 'unavailable',
      availabilityText: 'Unavailable'
    }
  }

  const weekday = WEEKDAY_KEYS[new Date(year, month, dayNumber).getDay()]
  const weeklyAvailability = weeklyAvailabilityByDay[weekday]

  if (!weeklyAvailability) {
    return {
      dayNumber,
      isoDate,
      isEmpty: false,
      availabilityState: 'none',
      availabilityText: ''
    }
  }

  const hasTimes = weeklyAvailability.startTime && weeklyAvailability.endTime

  return {
    dayNumber,
    isoDate,
    isEmpty: false,
    availabilityState: 'available',
    availabilityText: hasTimes ? `${weeklyAvailability.startTime} - ${weeklyAvailability.endTime}` : 'Available'
  }
}

/**
 * Builds the current month's calendar data.
 * @param {Date} [referenceDate=new Date()] - Date used to choose the displayed month.
 * @param {object|null} [availabilityPreferences=null] - Lecturer availability preferences.
 * @returns {{dayLabels: string[], monthLabel: string, weeks: Array<Array<object>>}} Calendar view data.
 */
const buildCurrentMonthCalendar = function (referenceDate = new Date(), availabilityPreferences = null) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeklyAvailabilityByDay = {}
  const weeklyAvailability = Array.isArray(availabilityPreferences?.weeklyAvailability)
    ? availabilityPreferences.weeklyAvailability
    : []
  const exceptionDateSet = new Set(Array.isArray(availabilityPreferences?.exceptionDates)
    ? availabilityPreferences.exceptionDates
    : [])
  const weeks = []
  let dayNumber = 1

  weeklyAvailability.forEach(function (entry) {
    if (!entry || typeof entry.day !== 'string') {
      return
    }

    weeklyAvailabilityByDay[entry.day] = entry
  })

  while (dayNumber <= daysInMonth) {
    const week = []

    for (let dayIndex = 0; dayIndex < DAY_LABELS.length; dayIndex++) {
      if ((weeks.length === 0 && dayIndex < firstDayIndex) || dayNumber > daysInMonth) {
        week.push(buildEmptyCalendarCell())
      } else {
        week.push(buildCalendarDayCell(year, month, dayNumber, weeklyAvailabilityByDay, exceptionDateSet))
        dayNumber += 1
      }
    }

    weeks.push(week)
  }

  return {
    dayLabels: DAY_LABELS,
    monthLabel: `${MONTH_LABELS[month]} ${year}`,
    weeks
  }
}

module.exports = {
  buildCurrentMonthCalendar
}

const DAY_LABELS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
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
 * Builds the current month's calendar data.
 * @param {Date} [referenceDate=new Date()] - Date used to choose the displayed month.
 * @returns {{dayLabels: string[], monthLabel: string, weeks: Array<Array<number|string>>}} Calendar view data.
 */
const buildCurrentMonthCalendar = function (referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks = []
  let dayNumber = 1

  while (dayNumber <= daysInMonth) {
    const week = []

    for (let dayIndex = 0; dayIndex < DAY_LABELS.length; dayIndex++) {
      if ((weeks.length === 0 && dayIndex < firstDayIndex) || dayNumber > daysInMonth) {
        week.push('')
      } else {
        week.push(dayNumber)
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

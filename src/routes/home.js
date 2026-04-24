const express = require('express')
const { buildCurrentMonthCalendar } = require('../utils/calendar')

const router = express.Router()
const HOME_TITLES = Object.freeze({
  lecturer: 'Lecturer Home',
  student: 'Student Home'
})

router.get('/', (req, res) => {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''

  res.render('home', {
    calendar: buildCurrentMonthCalendar(),
    title: HOME_TITLES[role] || 'Home',
    homeTitle: HOME_TITLES[role] || 'Home',
    role,
    username
  })
})

module.exports = router

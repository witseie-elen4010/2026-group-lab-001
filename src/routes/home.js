'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { searchLecturers } = require('../models/user_db')
const { buildCurrentMonthCalendar } = require('../utils/calendar')

const router = express.Router()

const HOME_TITLES = Object.freeze({
  lecturer: 'Lecturer Home',
  student: 'Student Home'
})

router.get('/', async (req, res) => {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''
  const universityId = req.session?.user?.universityId || ''
  const calendar = buildCurrentMonthCalendar()
  const title = HOME_TITLES[role] || 'Home'
  const homeTitle = HOME_TITLES[role] || 'Home'

  if (role !== 'student') {
    return res.render('home', { title, homeTitle, role, username, calendar, lecturers: [], faculties: [], schools: [], query: '', facultyId: '', schoolId: '' })
  }

  const query = req.query.q?.trim() || ''
  const facultyId = req.query.facultyId?.trim() || ''
  const schoolId = req.query.schoolId?.trim() || ''

  try {
    await connectToDatabase()
    const allLecturers = await searchLecturers({ universityId, query })

    const faculties = [...new Set(allLecturers.map(l => l.facultyId).filter(Boolean))]
    const schools = [...new Set(
      allLecturers
        .filter(l => !facultyId || l.facultyId === facultyId)
        .map(l => l.schoolId)
        .filter(Boolean)
    )]
    const lecturers = allLecturers.filter(l =>
      (!facultyId || l.facultyId === facultyId) &&
      (!schoolId || l.schoolId === schoolId)
    )

    return res.render('home', { title, homeTitle, role, username, calendar, lecturers, faculties, schools, query, facultyId, schoolId })
  } catch {
    return res.render('home', { title, homeTitle, role, username, calendar, lecturers: [], faculties: [], schools: [], query, facultyId, schoolId })
  }
})

module.exports = router

'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getLecturerAvailability } = require('../models/lecturer_availability_db')
const { searchLecturers } = require('../models/user_db')
const { buildCurrentMonthCalendar } = require('../utils/calendar')

const router = express.Router()

const HOME_TITLES = Object.freeze({
  lecturer: 'Lecturer Home',
  student: 'Student Home'
})

const PAGE_SIZE = 20

router.get('/', async (req, res) => {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''
  const universityId = req.session?.user?.universityId || ''
  const title = HOME_TITLES[role] || 'Home'
  const homeTitle = HOME_TITLES[role] || 'Home'
  let calendar = buildCurrentMonthCalendar()

  if (role === 'lecturer' && username) {
    try {
      await connectToDatabase()
      const availabilityPreferences = await getLecturerAvailability(username)
      calendar = buildCurrentMonthCalendar(new Date(), availabilityPreferences)
    } catch {
      calendar = buildCurrentMonthCalendar()
    }
  }

  if (role !== 'student') {
    return res.render('home', { title, homeTitle, role, username, calendar, lecturers: [], faculties: [], schools: [], query: '', facultyId: '', schoolId: '', page: 1, totalPages: 0 })
  }

  const query = req.query.q?.trim() || ''
  const facultyId = req.query.facultyId?.trim() || ''
  const schoolId = req.query.schoolId?.trim() || ''
  const page = Math.max(1, parseInt(req.query.page) || 1)

  try {
    await connectToDatabase()
    const allLecturers = await searchLecturers({ universityId, query })

    const faculties = [...new Set(allLecturers.map(l => l.facultyId).filter(Boolean))]
    const filteredLecturers = allLecturers.filter(l =>
      (!facultyId || l.facultyId === facultyId) &&
      (!schoolId || l.schoolId === schoolId)
    )
    const schools = [...new Set(
      allLecturers
        .filter(l => !facultyId || l.facultyId === facultyId)
        .map(l => l.schoolId)
        .filter(Boolean)
    )]

    const totalPages = Math.ceil(filteredLecturers.length / PAGE_SIZE)
    const currentPage = Math.min(page, Math.max(1, totalPages))
    const lecturers = filteredLecturers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ lecturers, page: currentPage, totalPages })
    }
    return res.render('home', { title, homeTitle, role, username, calendar, lecturers, faculties, schools, query, facultyId, schoolId, page: currentPage, totalPages })
  } catch {
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ lecturers: [], page: 1, totalPages: 0 })
    }
    return res.render('home', { title, homeTitle, role, username, calendar, lecturers: [], faculties: [], schools: [], query, facultyId, schoolId, page: 1, totalPages: 0 })
  }
})

module.exports = router

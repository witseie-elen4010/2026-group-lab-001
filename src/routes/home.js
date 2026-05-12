'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getConsultationsForCalendar } = require('../models/consultation_db')
const { getLecturerAvailability } = require('../models/lecturer_availability_db')
const { getUser, searchLecturers } = require('../models/user_db')
const { buildCurrentMonthCalendar } = require('../utils/calendar')

const router = express.Router()

const HOME_TITLES = Object.freeze({
  admin: 'Admin Home',
  lecturer: 'Lecturer Home',
  student: 'Student Home'
})

const PAGE_SIZE = 20

const buildFollowedLecturerSet = function (user) {
  if (!Array.isArray(user?.followedLecturers)) {
    return new Set()
  }

  return new Set(user.followedLecturers.filter(Boolean))
}

const addFollowStateToLecturers = function (lecturers, followedLecturers) {
  return lecturers.map(function (lecturer) {
    return {
      ...lecturer,
      isFollowed: followedLecturers.has(lecturer.username)
    }
  })
}

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

  if (role !== 'student' && role !== 'admin') {
    return res.render('home', { title, homeTitle, role, username, calendar, consultationsByDate: {}, lecturers: [], faculties: [], schools: [], query: '', facultyId: '', schoolId: '', page: 1, totalPages: 0 })
  }

  const query = req.query.q?.trim() || ''
  const facultyId = req.query.facultyId?.trim() || ''
  const schoolId = req.query.schoolId?.trim() || ''
  const page = Math.max(1, parseInt(req.query.page) || 1)

  const calendarNow = new Date()
  const calendarYear = calendarNow.getFullYear()
  const calendarMonth = calendarNow.getMonth()
  const paddedMonth = String(calendarMonth + 1).padStart(2, '0')
  const daysInCalendarMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const monthStart = `${calendarYear}-${paddedMonth}-01T00:00`
  const monthEnd = `${calendarYear}-${paddedMonth}-${String(daysInCalendarMonth).padStart(2, '0')}T23:59~`

  try {
    await connectToDatabase()
    const [allLecturers, calendarConsultations, currentUser] = await Promise.all([
      searchLecturers({ universityId, query }),
      getConsultationsForCalendar(username, monthStart, monthEnd),
      role === 'student' ? getUser(username) : Promise.resolve(null)
    ])
    const followedLecturers = buildFollowedLecturerSet(currentUser)

    const consultationsByDate = {}
    calendarConsultations.forEach(function (consultation) {
      if (!consultationsByDate[consultation.date]) {
        consultationsByDate[consultation.date] = []
      }
      consultationsByDate[consultation.date].push(consultation)
    })

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
    const lecturers = addFollowStateToLecturers(
      filteredLecturers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
      followedLecturers
    )

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ lecturers, page: currentPage, totalPages })
    }
    return res.render('home', { title, homeTitle, role, username, calendar, consultationsByDate, lecturers, faculties, schools, query, facultyId, schoolId, page: currentPage, totalPages })
  } catch {
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ lecturers: [], page: 1, totalPages: 0 })
    }
    return res.render('home', { title, homeTitle, role, username, calendar, consultationsByDate: {}, lecturers: [], faculties: [], schools: [], query, facultyId, schoolId, page: 1, totalPages: 0 })
  }
})

module.exports = router

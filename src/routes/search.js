'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { searchLecturers } = require('../models/user_db')
const { getSession } = require('../utils/session')

const ROUTER = express.Router()

ROUTER.get('/', async (req, res) => {
  const session = getSession(req)
  if (!session) return res.redirect('/login')

  const query = req.query.q?.trim() || ''
  const facultyId = req.query.facultyId?.trim() || ''
  const schoolId = req.query.schoolId?.trim() || ''

  try {
    await connectToDatabase()
    const allLecturers = await searchLecturers({ universityId: session.universityId, query })

    const faculties = [...new Set(allLecturers.map(lecturer => lecturer.facultyId).filter(Boolean))]
    const schools = [...new Set(
      allLecturers
        .filter(lecturer => !facultyId || lecturer.facultyId === facultyId)
        .map(lecturer => lecturer.schoolId)
        .filter(Boolean)
    )]
    const lecturers = allLecturers.filter(lecturer =>
      (!facultyId || lecturer.facultyId === facultyId) &&
      (!schoolId || lecturer.schoolId === schoolId)
    )

    return res.render('search', { title: 'Find a Lecturer', session, lecturers, faculties, schools, query, facultyId, schoolId })
  } catch {
    return res.render('search', { title: 'Find a Lecturer', session, lecturers: [], faculties: [], schools: [], query, facultyId, schoolId })
  }
})

module.exports = ROUTER

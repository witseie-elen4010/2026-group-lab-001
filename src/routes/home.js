'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { searchLecturers } = require('../models/user_db')
const { getSession } = require('../utils/session')

const ROUTER = express.Router()

/**
 * Renders the home page, including lecturer search results for student users.
 * @param {import('express').Request} req - Express request object with optional query params `q`, `facultyId`, `schoolId`.
 * @param {import('express').Response} res - Express response object.
 */
ROUTER.get('/', async (req, res) => {
  const session = getSession(req)
  if (!session) return res.redirect('/login')

  if (session.role !== 'student') {
    return res.render('home', { title: 'Home', session, lecturers: [], faculties: [], schools: [], query: '', facultyId: '', schoolId: '' })
  }

  const query = req.query.q?.trim() || ''
  const facultyId = req.query.facultyId?.trim() || ''
  const schoolId = req.query.schoolId?.trim() || ''

  try {
    await connectToDatabase()
    const allLecturers = await searchLecturers({ universityId: session.universityId, query })

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

    return res.render('home', { title: 'Home', session, lecturers, faculties, schools, query, facultyId, schoolId })
  } catch {
    return res.render('home', { title: 'Home', session, lecturers: [], faculties: [], schools: [], query, facultyId, schoolId })
  }
})

module.exports = ROUTER

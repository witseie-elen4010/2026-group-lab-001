const express = require('express')
const { connectToDatabase } = require('../models/db')
const {
  searchFaculties,
  searchSchools,
  searchUniversities
} = require('../models/university_db')

const ROUTER = express.Router()
const INSTITUTION_SEARCH_LIMIT = 8

ROUTER.get('/universities', async (req, res) => {
  const query = req.query.query?.trim() || ''

  if (!query) {
    return res.json({ results: [] })
  }

  try {
    await connectToDatabase()
    const universities = await searchUniversities(query, INSTITUTION_SEARCH_LIMIT)

    return res.json({
      results: universities.map((universityDocument) => universityDocument.name)
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Sorry. We can not search universities right now.',
      results: []
    })
  }
})

ROUTER.get('/faculties', async (req, res) => {
  const query = req.query.query?.trim() || ''
  const university = req.query.university?.trim() || ''

  if (!query) {
    return res.json({ results: [] })
  }

  try {
    await connectToDatabase()
    const faculties = await searchFaculties(query, {
      limit: INSTITUTION_SEARCH_LIMIT,
      university
    })

    return res.json({
      results: faculties.map((facultyDocument) => facultyDocument.name)
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Sorry. We can not search faculties right now.',
      results: []
    })
  }
})

ROUTER.get('/schools', async (req, res) => {
  const query = req.query.query?.trim() || ''
  const university = req.query.university?.trim() || ''
  const faculty = req.query.faculty?.trim() || ''

  if (!query) {
    return res.json({ results: [] })
  }

  try {
    await connectToDatabase()
    const schools = await searchSchools(query, {
      faculty,
      limit: INSTITUTION_SEARCH_LIMIT,
      university
    })

    return res.json({
      results: schools.map((schoolDocument) => schoolDocument.name)
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Sorry. We could not search schools right now.',
      results: []
    })
  }
})

module.exports = ROUTER

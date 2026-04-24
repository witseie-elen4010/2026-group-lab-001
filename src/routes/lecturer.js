'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getUser } = require('../models/user_db')
const router = express.Router()

/**
 * Renders the lecturer profile page for the given username.
 * @param {import('express').Request} req - Express request object with `params.username`.
 * @param {import('express').Response} res - Express response object.
 */
router.get('/:username', async (req, res) => {
  const session = req.session.user

  try {
    await connectToDatabase()
    const lecturer = await getUser(req.params.username)

    if (!lecturer || lecturer.role !== 'lecturer') {
      return res.status(404).render('lecturer', { title: 'Not Found', lecturer: null, session })
    }

    return res.render('lecturer', {
      title: `${lecturer.firstName} ${lecturer.lastName}`,
      lecturer,
      session
    })
  } catch {
    return res.status(500).render('lecturer', { title: 'Error', lecturer: null, session })
  }
})

module.exports = router

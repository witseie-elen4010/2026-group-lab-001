'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getAllLogs } = require('../models/logs_db')

const router = express.Router()

const renderLogs = function (res, { statusCode = 200, error = '', username = '', logs = [] } = {}) {
  return res.status(statusCode).render('logs', {
    error,
    title: 'View Logs',
    username,
    logs
  })
}

router.get('/', async (req, res) => {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''

  if (role !== 'admin') {
    return renderLogs(res, {
      error: 'Only the admin can view logs.',
      statusCode: 403,
      username
    })
  }

  try {
    await connectToDatabase()
    const logs = await getAllLogs()
    return renderLogs(res, { username, logs })
  } catch (error) {
    return renderLogs(res, {
      error: 'Unable to load logs right now.',
      statusCode: 500,
      username
    })
  }
})

module.exports = router

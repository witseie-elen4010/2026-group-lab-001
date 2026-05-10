'use strict'

const express = require('express')
const { connectToDatabase } = require('../models/db')
const { getLogsPage } = require('../models/logs_db')

const router = express.Router()
const LOGS_PER_PAGE = 50

const parsePageNumber = function (value) {
  const page = Number.parseInt(value, 10)

  if (!Number.isInteger(page) || page < 1) {
    return 1
  }

  return page
}

const renderLogs = function (res, {
  statusCode = 200,
  error = '',
  username = '',
  logs = [],
  page = 1,
  hasNextPage = false
} = {}) {
  return res.status(statusCode).render('logs', {
    error,
    title: 'View Logs',
    username,
    logs,
    page,
    hasNextPage,
    hasPreviousPage: page > 1
  })
}

router.get('/', async (req, res) => {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''

  if (role !== 'admin') {
    return renderLogs(res, {
      error: 'Only the admin can view logs.',
      statusCode: 403,
      username,
      page: 1
    })
  }

  const page = parsePageNumber(req.query.page)

  try {
    await connectToDatabase()
    const { logs, hasNextPage } = await getLogsPage(page, LOGS_PER_PAGE)
    return renderLogs(res, { username, logs, page, hasNextPage })
  } catch (error) {
    return renderLogs(res, {
      error: 'Unable to load logs right now.',
      statusCode: 500,
      username,
      page
    })
  }
})

module.exports = router

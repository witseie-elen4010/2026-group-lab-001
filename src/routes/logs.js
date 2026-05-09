'use strict'

const express = require('express')

const router = express.Router()

const renderLogs = function (res, { statusCode = 200, error = '', username = '' } = {}) {
  return res.status(statusCode).render('logs', {
    error,
    title: 'View Logs',
    username
  })
}

router.get('/', (req, res) => {
  const role = req.session?.user?.role || ''
  const username = req.session?.user?.username || ''

  if (role !== 'admin') {
    return renderLogs(res, {
      error: 'Only the admin can view logs.',
      statusCode: 403,
      username
    })
  }

  return renderLogs(res, { username })
})

module.exports = router

const express = require('express')

const router = express.Router()

const DASHBOARD_TITLE = 'Lecturer Dashboard'

router.get('/', function (req, res) {
  const username = req.session?.user?.username || ''

  return res.status(200).render('scheduled_consultations', {
    homePath: '/home',
    title: DASHBOARD_TITLE,
    username
  })
})

module.exports = router

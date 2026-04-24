const express = require('express')

const router = express.Router()

router.get('/', (req, res) => {
  const username = req.session?.user?.username || ''

  res.status(501).render('schedule_consultation', {
    error: 'This page is not available yet.',
    homePath: '/home',
    message: 'Scheduling a consultation has not been built yet.',
    title: 'Schedule a Consultation',
    username
  })
})

module.exports = router

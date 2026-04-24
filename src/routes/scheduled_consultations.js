const express = require('express')

const router = express.Router()

router.get('/', (req, res) => {
  const username = req.session?.user?.username || ''

  res.status(501).render('scheduled_consultations', {
    error: 'This page is not available yet.',
    homePath: '/home',
    message: 'Scheduled consultations have not been built yet.',
    title: 'Scheduled Consultations',
    username
  })
})

module.exports = router

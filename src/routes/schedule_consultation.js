const express = require('express')

const router = express.Router()

router.get('/', (req, res) => {
  const username = req.session?.user?.username || ''

  res.render('schedule_consultation', {
    title: 'Schedule a Consultation',
    username
  })
})

module.exports = router

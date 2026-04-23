const express = require('express')

const router = express.Router()

router.get('/', (req, res) => {
  const username = req.session?.user?.username || ''

  res.render('scheduled_consultations', {
    title: 'Scheduled Consultations',
    username
  })
})

module.exports = router

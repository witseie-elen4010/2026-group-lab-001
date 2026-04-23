const express = require('express')

const router = express.Router()

router.get('/', (req, res) => {
  const username = req.query.username?.trim() || ''
  res.render('home', {
    title: 'Home',
    username
  })
})

module.exports = router

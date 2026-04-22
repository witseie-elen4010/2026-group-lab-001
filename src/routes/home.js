const express = require('express')

const ROUTER = express.Router()

ROUTER.get('/', (req, res) => {
  const username = req.query.username?.trim() || ''
  res.render('home', {
    title: 'Home',
    username
  })
})

module.exports = ROUTER

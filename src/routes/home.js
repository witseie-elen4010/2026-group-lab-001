'use strict'

const express = require('express')
const { getSession } = require('../utils/session')

const ROUTER = express.Router()

ROUTER.get('/', (req, res) => {
  const session = getSession(req)
  if (!session) return res.redirect('/login')
  return res.render('home', { title: 'Home', session })
})
module.exports = ROUTER

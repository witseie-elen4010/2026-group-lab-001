const express = require('express')
const passport = require('../config/passport')
const { connectToDatabase } = require('../models/db')
const { getUserByGoogleId, getUserByEmail, linkGoogleId } = require('../models/user_db')
const router = express.Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, profile) => {
    if (err || !profile) {
      req.session.flash = { error: 'Google sign-in was cancelled or denied.' }
      return res.redirect('/login')
    }

    try {
      await connectToDatabase()
      const googleId = profile.id
      const email = (profile.emails?.[0]?.value || '').toLowerCase()

      let user = await getUserByGoogleId(googleId)

      if (!user && email) {
        user = await getUserByEmail(email)
        if (user) {
          await linkGoogleId(user.username, googleId)
        }
      }

      if (user) {
        req.session.user = {
          role: user.role || '',
          username: user.username || '',
          universityId: user.universityId || '',
          facultyId: user.facultyId || '',
          schoolId: user.schoolId || '',
          firstName: user.firstName || '',
          lastName: user.lastName || ''
        }
        return res.redirect('/home')
      }

      req.session.pendingGoogle = {
        googleId,
        email,
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || ''
      }
      return res.redirect('/register/complete')
    } catch (callbackError) {
      return next(callbackError)
    }
  })(req, res, next)
})

module.exports = router

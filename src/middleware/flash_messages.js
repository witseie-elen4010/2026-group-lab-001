const flashMessages = function (req, res, next) {
  try {
    const flash = req.session && req.session.flash ? req.session.flash : null

    if (flash) {
      res.locals.flash = flash
      delete req.session.flash
    } else {
      res.locals.flash = {}
    }
  } catch (err) {
    res.locals.flash = {}
  }

  next()
}

module.exports = flashMessages

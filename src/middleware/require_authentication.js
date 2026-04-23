/**
 * Redirects unauthenticated users to the login page.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware callback.
 * @returns {void|import('express').Response} Redirect response or next middleware.
 */
const requireAuthentication = function (req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login')
  }

  return next()
}

module.exports = requireAuthentication

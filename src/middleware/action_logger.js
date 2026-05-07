const ACTION_MAP = [
  { method: 'GET', pattern: /^\/login$/, label: 'Viewed Login page' },
  { method: 'POST', pattern: /^\/login$/, label: 'Logged in' },
  { method: 'GET', pattern: /^\/register$/, label: 'Viewed Register page' },
  { method: 'POST', pattern: /^\/register$/, label: 'Registered account' },
  { method: 'GET', pattern: /^\/home$/, label: 'Viewed Home page' },
  { method: 'GET', pattern: /^\/consultations\/new$/, label: 'Viewed Create Consultation page' },
  {
    method: 'POST',
    pattern: /^\/consultations$/,
    label: function (req, res) {
      if (res.statusCode !== 302) {
        return 'Could not create a consultation.'
      }
      const lecturer = req.body.lecturerId?.trim() || 'unknown'
      return `Created Consultation with ${lecturer}`
    }
  },
  { method: 'GET', pattern: /^\/join_consultation$/, label: 'Viewed Join Consultation page' },
  {
    method: 'POST',
    pattern: /^\/join_consultation\/[^/]+\/join$/,
    label: function (req, res) {
      if (res.statusCode !== 302) {
        return 'Could not join the consultation.'
      }
      const consultation = req.params.consultationId
      return `Joined consultation ${consultation}.`
    }
  },
  { method: 'GET', pattern: /^\/scheduled_consultations$/, label: 'Viewed lecturer dashboard' },
  { method: 'GET', pattern: /^\/schedule_consultation$/, label: 'Viewed Schedule Consultation page' },
  { method: 'POST', pattern: /^\/schedule_consultation$/, label: 'Checked lecturer availability' },
  {
    method: 'GET',
    pattern: /^\/user_profile$/,
    label: function (req, res) {
      const viewer = req.session && req.session.user && req.session.user.username
      const target = (req.query && (req.query.user || req.query.username || '')).trim() || viewer
      if (target && target !== viewer) {
        return `Viewed profile of ${target}`
      }
      return 'Viewed own profile'
    }
  },
  { method: 'POST', pattern: /^\/user_profile$/, label: 'Updated user profile' },
  { method: 'GET', pattern: /^\/institutions\/universities$/, label: 'Searched universities' },
  { method: 'GET', pattern: /^\/institutions\/faculties$/, label: 'Searched faculties' },
  { method: 'GET', pattern: /^\/institutions\/schools$/, label: 'Searched schools' }
]
// ^ add here per http method asseblief. I repeat ADD HERE PER HTTP METHOD

const getActionLabel = function (method, path, req, res) {
  for (const entry of ACTION_MAP) {
    if (entry.method === method && entry.pattern.test(path)) {
      return typeof entry.label === 'function' ? entry.label(req, res) : entry.label
    }
  }
  return null
}

const formatTimestamp = function () {
  const rightNow = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${rightNow.getFullYear()}-${pad(rightNow.getMonth() + 1)}-${pad(rightNow.getDate())} ` +
         `${pad(rightNow.getHours())}:${pad(rightNow.getMinutes())}:${pad(rightNow.getSeconds())}`
}

const actionLogger = function (req, res, next) {
  res.on('finish', function () {
    const cleanPath = req.originalUrl.split('?')[0]
    const label = getActionLabel(req.method, cleanPath, req, res)
    if (!label) {
      return
    }
    const sessionUser = req.session && req.session.user
    const identity = sessionUser
      ? `${sessionUser.username} [${sessionUser.role || 'unknown'}]`
      : 'anonymous'

    console.log(`[${formatTimestamp()}] ${identity} | ${label} | HTTP ${res.statusCode}`)
  })
  next()
}

module.exports = actionLogger

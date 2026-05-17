const { connectToDatabase } = require('../models/db')
const { addLog } = require('../models/logs_db')

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
  {
    method: 'POST',
    pattern: /^\/schedule_consultation$/,
    label: function (req, res) {
      if (res.statusCode !== 302) {
        return 'Could not check Lecturer Availability.'
      }
      const lecturer = (req.body.lecturer || req.body.username || '').trim()
      return `Checked availability of Lecturer ${lecturer}.`
    }
  },
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
  {
    method: 'GET',
    pattern: /^\/institutions\/universities$/,
    label: function (req, res) {
      if (res.statusCode === 500) {
        return 'Could not check Universities.'
      }
      const university = req.query.query?.trim() || ''
      if (!university) {
        return 'Searched Universities.'
      }
      return `Searched Universities for ${university}.`
    }
  },
  {
    method: 'GET',
    pattern: /^\/institutions\/faculties$/,
    label: function (req, res) {
      if (res.statusCode === 500) {
        return 'Could not check Faculties.'
      }
      const faculty = req.query.query?.trim() || ''
      if (!faculty) {
        return 'Searched Faculties.'
      }
      return `Searched Faculties for ${faculty}.`
    }
  },
  {
    method: 'GET',
    pattern: /^\/institutions\/schools$/,
    label: function (req, res) {
      if (res.statusCode === 500) {
        return 'Could not check Schools.'
      }
      const school = req.query.query?.trim() || ''
      if (!school) {
        return 'Searched Schools.'
      }
      return `Searched Schools for ${school}.`
    }
  },
  { method: 'GET', pattern: /^\/daily_summary$/, label: 'Checked Daily Summary' }
]
/* ^ add here per http method asseblief. I repeat ADD HERE PER HTTP METHOD
Use static labels when user is not accessing another database item or (as like
with updating universities/faculties/schools on user profile) when the relevant
data item cannot be separated (cannot determine which institution detail is changed).
Add corresponding unit tests in tests/unit/middleware/action_logger.test.js
*/
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

const shouldSkipDatabaseWrite = function () {
  return process.env.NODE_ENV === 'test' || process.env.DISABLE_ACTION_LOG_DB_WRITES === 'true'
}

const actionLogger = function (req, res, next) {
  res.on('finish', function () {
    const cleanPath = req.originalUrl.split('?')[0]

    // Skip logging for the logs page itself
    if (req.method === 'GET' && cleanPath === '/logs') {
      return
    }

    const label = getActionLabel(req.method, cleanPath, req, res)
    if (!label) {
      return
    }
    const sessionUser = req.session && req.session.user
    const username = sessionUser
      ? sessionUser.username
      : 'anonymous'
    const role = sessionUser ? (sessionUser.role || 'unknown') : 'unknown'
    const identity = `${username} [${role}]`
    const logMessage = `[${formatTimestamp()}] ${identity} | ${label} | HTTP ${res.statusCode}`

    console.log(logMessage)

    if (shouldSkipDatabaseWrite()) {
      return
    }

    // Save to database
    try {
      connectToDatabase().then(function () {
        const now = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
        const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

        addLog({
          date,
          time,
          username,
          label,
          httpCode: res.statusCode
        }).catch(function (error) {
          // Silently fail if database write fails - don't interrupt response
          console.error('Failed to write log to database:', error.message)
        })
      }).catch(function (error) {
        // Silently fail if database connection fails
        console.error('Failed to connect to database for logging:', error.message)
      })
    } catch (error) {
      // Silently fail if any error occurs during logging
      console.error('Error during log write:', error.message)
    }
  })
  next()
}

module.exports = actionLogger

const actionLogger = require('../../../src/middleware/action_logger')

const makeReq = function ({ method = 'GET', url = '/', session = {}, body = {}, query = {}, params = {} } = {}) {
  return { method, originalUrl: url, session, body, query, params }
}

const makeRes = function (statusCode = 200) {
  const handlers = {}
  return {
    statusCode,
    on: function (event, fn) { handlers[event] = fn },
    emit: function (event) { if (handlers[event]) handlers[event]() }
  }
}

const runLogger = function (req, res) {
  const next = jest.fn()
  actionLogger(req, res, next)
  expect(next).toHaveBeenCalledTimes(1)
  res.emit('finish')
}

describe('actionLogger middleware', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  test('calls next()', () => {
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn()
    actionLogger(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  test('does not log unrecognised routes', () => {
    const req = makeReq({ url: '/unknown/route' })
    const res = makeRes()
    runLogger(req, res)
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  describe('identity', () => {
    test('shows username and role for authenticated users', () => {
      const req = makeReq({ url: '/home', session: { user: { username: 'jsmith', role: 'student' } } })
      const res = makeRes()
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('jsmith [student]'))
    })

    test('shows "anonymous" when no session user', () => {
      const req = makeReq({ url: '/login' })
      const res = makeRes()
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('anonymous'))
    })

    test('shows "unknown" role when role is missing', () => {
      const req = makeReq({ url: '/home', session: { user: { username: 'jsmith' } } })
      const res = makeRes()
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('jsmith [unknown]'))
    })
  })

  describe('log format', () => {
    test('includes a timestamp in YYYY-MM-DD HH:MM:SS format', () => {
      const req = makeReq({ url: '/home', session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes()
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/))
    })

    test('includes the HTTP status code', () => {
      const req = makeReq({ url: '/home', session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(200)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('HTTP 200'))
    })
  })

  describe('static labels', () => {
    const cases = [
      ['GET', '/login', 'Viewed Login page'],
      ['POST', '/login', 'Logged in'],
      ['GET', '/register', 'Viewed Register page'],
      ['POST', '/register', 'Registered account'],
      ['GET', '/home', 'Viewed Home page'],
      ['GET', '/consultations/new', 'Viewed Create Consultation page'],
      ['GET', '/join_consultation', 'Viewed Join Consultation page'],
      ['GET', '/scheduled_consultations', 'Viewed lecturer dashboard'],
      ['GET', '/schedule_consultation', 'Viewed Schedule Consultation page'],
      ['POST', '/user_profile', 'Updated user profile']
    ]

    test.each(cases)('%s %s logs "%s"', (method, url, expectedLabel) => {
      const req = makeReq({ method, url, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes()
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(expectedLabel))
    })
  })

  describe('POST /consultations', () => {
    test('logs lecturer username on successful creation (302)', () => {
      const req = makeReq({ method: 'POST', url: '/consultations', body: { lecturerId: 'drjones' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(302)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Created Consultation with drjones'))
    })

    test('logs failure message when consultation is not created', () => {
      const req = makeReq({ method: 'POST', url: '/consultations', body: { lecturerId: 'drjones' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(400)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not create a consultation.'))
    })

    test('falls back to "unknown" when lecturerId is absent on success', () => {
      const req = makeReq({ method: 'POST', url: '/consultations', body: {}, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(302)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Created Consultation with unknown'))
    })
  })

  describe('POST /schedule_consultation', () => {
    test('logs lecturer username on successful availability check (302)', () => {
      const req = makeReq({ method: 'POST', url: '/schedule_consultation', body: { lecturer: 'drjones' }, session: { user: { username: 'u', role: 'lecturer' } } })
      const res = makeRes(302)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Checked availability of Lecturer drjones.'))
    })

    test('logs failure message when availability check fails', () => {
      const req = makeReq({ method: 'POST', url: '/schedule_consultation', body: { lecturer: 'drjones' }, session: { user: { username: 'u', role: 'lecturer' } } })
      const res = makeRes(400)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not check Lecturer Availability.'))
    })
  })

  describe('POST /join_consultation/:id/join', () => {
    test('logs consultation id on successful join (302)', () => {
      const req = makeReq({ method: 'POST', url: '/join_consultation/abc123/join', params: { consultationId: 'abc123' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(302)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Joined consultation abc123.'))
    })

    test('logs failure when join fails', () => {
      const req = makeReq({ method: 'POST', url: '/join_consultation/abc123/join', session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(400)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not join the consultation.'))
    })
  })

  describe('GET /institutions/universities', () => {
    test('logs search term on success (302)', () => {
      const req = makeReq({ url: '/institutions/universities', query: { query: 'Wits' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(302)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Searched Universities for Wits.'))
    })

    test('logs not-found message on non-302/non-500', () => {
      const req = makeReq({ url: '/institutions/universities', query: { query: 'Wits' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(200)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('University not found in search results'))
    })

    test('logs server error message on 500', () => {
      const req = makeReq({ url: '/institutions/universities', query: {}, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(500)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not check Universities.'))
    })
  })

  describe('GET /institutions/faculties', () => {
    test('logs search term on success (302)', () => {
      const req = makeReq({ url: '/institutions/faculties', query: { query: 'Engineering' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(302)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Searched Faculties for Engineering.'))
    })

    test('logs not-found message on non-302/non-500', () => {
      const req = makeReq({ url: '/institutions/faculties', query: { query: 'Engineering' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(200)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Faculty not found in search results'))
    })

    test('logs server error message on 500', () => {
      const req = makeReq({ url: '/institutions/faculties', query: {}, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(500)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not check Faculties.'))
    })
  })

  describe('GET /institutions/schools', () => {
    test('logs search term on success (302)', () => {
      const req = makeReq({ url: '/institutions/schools', query: { query: 'EECE' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(302)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Searched Schools for EECE.'))
    })

    test('logs not-found message on non-302/non-500', () => {
      const req = makeReq({ url: '/institutions/schools', query: { query: 'EECE' }, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(200)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('School not found in search results'))
    })

    test('logs server error message on 500', () => {
      const req = makeReq({ url: '/institutions/schools', query: {}, session: { user: { username: 'u', role: 'student' } } })
      const res = makeRes(500)
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not check Schools.'))
    })
  })

  describe('GET /user_profile', () => {
    test('logs "Viewed own profile" when no target query param', () => {
      const req = makeReq({ url: '/user_profile', query: {}, session: { user: { username: 'jsmith', role: 'student' } } })
      const res = makeRes()
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Viewed own profile'))
    })

    test('logs "Viewed own profile" when target matches viewer', () => {
      const req = makeReq({ url: '/user_profile', query: { user: 'jsmith' }, session: { user: { username: 'jsmith', role: 'student' } } })
      const res = makeRes()
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Viewed own profile'))
    })

    test('logs target username when viewing a different profile', () => {
      const req = makeReq({ url: '/user_profile', query: { user: 'drjones' }, session: { user: { username: 'jsmith', role: 'student' } } })
      const res = makeRes()
      runLogger(req, res)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Viewed profile of drjones'))
    })
  })
})

const { clearSession, getSession, setSession } = require('../../src/utils/session')

/**
 * Captures the Set-Cookie header written by setSession and returns the name=value portion.
 * @param {object} data - Session payload to encode.
 * @returns {string} The cookie name=value pair ready to use as a Cookie request header.
 */
const buildCookie = function (data) {
  let cookieHeader
  setSession({ setHeader: (_name, value) => { cookieHeader = value } }, data)
  return cookieHeader.split(';')[0]
}

describe('setSession', () => {
  test('Sets a signed Set-Cookie header on the response', () => {
    const mockRes = { setHeader: jest.fn() }
    setSession(mockRes, { username: 'alice', role: 'student' })

    expect(mockRes.setHeader).toHaveBeenCalledTimes(1)
    const [headerName, headerValue] = mockRes.setHeader.mock.calls[0]
    expect(headerName).toBe('Set-Cookie')
    expect(headerValue).toMatch(/^current_session=/)
    expect(headerValue).toContain('HttpOnly')
    expect(headerValue).toContain('SameSite=Strict')
    expect(headerValue).toContain('Max-Age=')
  })

  test('Encodes all session fields in the cookie payload', () => {
    const data = { username: 'alice', role: 'student', universityId: 'wits' }
    const [, payloadSig] = buildCookie(data).split('=')
    const dotIndex = payloadSig.lastIndexOf('.')
    const payload = payloadSig.slice(0, dotIndex)
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())

    expect(decoded).toEqual(data)
  })
})

describe('getSession', () => {
  test('Returns the session data from a valid cookie', () => {
    const data = { username: 'alice', role: 'student', universityId: 'wits' }
    const cookie = buildCookie(data)

    expect(getSession({ headers: { cookie } })).toEqual(data)
  })

  test('Returns null when no cookie header is present', () => {
    expect(getSession({ headers: {} })).toBeNull()
  })

  test('Returns null when the cookie string is empty', () => {
    expect(getSession({ headers: { cookie: '' } })).toBeNull()
  })

  test('Returns null when the session cookie is absent from a multi-cookie header', () => {
    expect(getSession({ headers: { cookie: 'other_cookie=somevalue' } })).toBeNull()
  })

  test('Returns null when the signature has been tampered with', () => {
    const cookie = buildCookie({ username: 'alice' })
    const tampered = cookie.slice(0, -4) + 'xxxx'

    expect(getSession({ headers: { cookie: tampered } })).toBeNull()
  })

  test('Returns null when the cookie value has no dot separator', () => {
    expect(getSession({ headers: { cookie: 'current_session=nodothere' } })).toBeNull()
  })
})

describe('clearSession', () => {
  test('Sets a Max-Age=0 cookie to expire the session', () => {
    const mockRes = { setHeader: jest.fn() }
    clearSession(mockRes)

    const [headerName, headerValue] = mockRes.setHeader.mock.calls[0]
    expect(headerName).toBe('Set-Cookie')
    expect(headerValue).toContain('current_session=')
    expect(headerValue).toContain('Max-Age=0')
  })
})

'use strict'
const { createHmac, timingSafeEqual } = require('node:crypto')

const SECRET = process.env.SESSION_SECRET || 'dev-secret'
const COOKIE_NAME = 'current_session'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24

/**
 * Signs a base64url-encoded payload using HMAC-SHA256.
 * @param {string} payload - The base64url-encoded string to sign.
 * @returns {Buffer} The HMAC-SHA256 digest.
 */
const sign = function (payload) {
  return createHmac('sha256', SECRET).update(payload).digest()
}

/**
 * Serialises session data into a signed cookie and sets it on the response.
 * @param {import('express').Response} res - Express response object.
 * @param {object} data - Session data to encode and store in the cookie.
 */
const setSession = function (res, data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = sign(payload).toString('base64url')
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${payload}.${signature}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE_SECONDS}`)
}

/**
 * Reads, verifies, and decodes the session cookie from the request.
 * @param {import('express').Request} req - Express request object.
 * @returns {object|null} Parsed session data, or null if absent or tampered.
 */
const getSession = function (req) {
  const raw = req.headers.cookie || ''
  const entry = raw.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE_NAME}=`))
  if (!entry) return null

  const cookieValue = entry.slice(COOKIE_NAME.length + 1)
  const dot = cookieValue.lastIndexOf('.')
  if (dot === -1) return null

  const payload = cookieValue.slice(0, dot)
  const signature = cookieValue.slice(dot + 1)
  const receivedSig = Buffer.from(signature, 'base64url')
  const expectedSig = sign(payload)

  if (receivedSig.length !== expectedSig.length) return null
  if (!timingSafeEqual(expectedSig, receivedSig)) return null

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
}

/**
 * Clears the session cookie on the response.
 * @param {import('express').Response} res - Express response object.
 */
const clearSession = function (res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`)
}

module.exports = { clearSession, getSession, setSession }

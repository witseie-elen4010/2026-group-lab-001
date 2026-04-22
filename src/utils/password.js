const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto')
const { promisify } = require('node:util')

const PASSWORD_HASH_KEY_LENGTH = 64
const PASSWORD_SALT_BYTE_LENGTH = 16
const SCRYPT_ASYNC = promisify(scrypt)

/**
 * Hashes a password using scrypt and a random salt.
 * @param {string} password - Plain-text password to hash.
 * @returns {Promise<string>} Salt and password hash in storage format.
 */
const hashPassword = async function (password) {
  const salt = randomBytes(PASSWORD_SALT_BYTE_LENGTH).toString('hex')
  const derivedKey = await SCRYPT_ASYNC(password, salt, PASSWORD_HASH_KEY_LENGTH)

  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * Verifies a plain-text password against a stored hash.
 * @param {string} password - Plain-text password to verify.
 * @param {string} storedHash - Stored salt and hash string.
 * @returns {Promise<boolean>} True when the password matches the stored hash.
 */
const verifyPassword = async function (password, storedHash) {
  const [salt, hashHex] = storedHash.split(':')

  if (!salt || !hashHex) {
    return false
  }

  const derivedKey = await SCRYPT_ASYNC(password, salt, PASSWORD_HASH_KEY_LENGTH)
  const storedKey = Buffer.from(hashHex, 'hex')

  if (storedKey.length !== derivedKey.length) {
    return false
  }

  return timingSafeEqual(storedKey, derivedKey)
}

module.exports = {
  hashPassword,
  verifyPassword
}

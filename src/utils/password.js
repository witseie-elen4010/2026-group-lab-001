const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);

  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, hashHex] = storedHash.split(':');

  if (!salt || !hashHex) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, 64);
  const storedKey = Buffer.from(hashHex, 'hex');
  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
}

module.exports = {
  hashPassword,
  verifyPassword
};
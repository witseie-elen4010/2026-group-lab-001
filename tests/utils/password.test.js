const { hashPassword, verifyPassword } = require('../../src/utils/password')

describe('password utility', () => {
  test('hashPassword returns salt and hash in storage format', async () => {
    const storedHash = await hashPassword('CorrectHorseBatteryStaple')
    const [salt, hashHex] = storedHash.split(':')

    expect(salt).toMatch(/^[0-9a-f]{32}$/)
    expect(hashHex).toMatch(/^[0-9a-f]{128}$/)
  })

  test('hashPassword produces distinct hashes for the same password', async () => {
    const firstHash = await hashPassword('CorrectHorseBatteryStaple')
    const secondHash = await hashPassword('CorrectHorseBatteryStaple')

    expect(firstHash).not.toBe(secondHash)
  })

  test('verifyPassword accepts the original password', async () => {
    const storedHash = await hashPassword('CorrectHorseBatteryStaple')

    await expect(
      verifyPassword('CorrectHorseBatteryStaple', storedHash)
    ).resolves.toBe(true)
  })

  test('verifyPassword rejects the wrong password', async () => {
    const storedHash = await hashPassword('CorrectHorseBatteryStaple')

    await expect(verifyPassword('wrong-password', storedHash)).resolves.toBe(false)
  })

  test('verifyPassword rejects malformed hashes', async () => {
    await expect(
      verifyPassword('CorrectHorseBatteryStaple', 'not-a-stored-hash')
    ).resolves.toBe(false)
  })

  test('verifyPassword rejects hashes with the wrong key length', async () => {
    const storedHash = await hashPassword('CorrectHorseBatteryStaple')
    const [salt] = storedHash.split(':')

    await expect(
      verifyPassword('CorrectHorseBatteryStaple', `${salt}:abcd`)
    ).resolves.toBe(false)
  })
})

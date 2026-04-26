const { hashPassword, verifyPassword } = require('../../src/utils/password')
// test password hashing functions
describe('password utility', () => {
  test('hashes passwords as salt and hash pairs', async () => {
    const hash = await hashPassword('welovesd3')

    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
  })

  test('creates different hashes for the same password', async () => {
    const firstHash = await hashPassword('welovesd3')
    const secondHash = await hashPassword('welovesd3')

    expect(firstHash).not.toBe(secondHash)
  })

  test('verifies a matching password', async () => {
    const hash = await hashPassword('welovesd3')

    await expect(verifyPassword('welovesd3', hash)).resolves.toBe(true)
  })

  test('rejects a non-matching password', async () => {
    const hash = await hashPassword('welovesd3')

    await expect(verifyPassword('different-password', hash)).resolves.toBe(false)
  })

  test('rejects malformed stored hashes', async () => {
    await expect(verifyPassword('welovesd3', 'not-a-valid-hash')).resolves.toBe(false)
  })
})

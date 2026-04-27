const requireAuthentication = require('../../src/middleware/require_authentication')
// authentication between pages
describe('require authentication middleware', () => {
  test('redirects unauthenticated requests to login', () => {
    const redirect = jest.fn()
    const next = jest.fn()
    const req = { session: {} }
    const res = { redirect }

    requireAuthentication(req, res, next)

    expect(redirect).toHaveBeenCalledWith('/login')
    expect(next).not.toHaveBeenCalled()
  })

  test('calls next for authenticated requests', () => {
    const redirect = jest.fn()
    const next = jest.fn()
    const req = { session: { user: { username: 'morris' } } }
    const res = { redirect }

    requireAuthentication(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(redirect).not.toHaveBeenCalled()
  })
})

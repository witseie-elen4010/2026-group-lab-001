const http = require('node:http')
const app = require('../src/app')
const { closeHttpServer } = require('./helpers/http_server')
// test express app deployment
describe('app entrypoint', () => {
  let baseUrl
  let server

  beforeAll(async () => {
    server = http.createServer(app)

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  afterAll(async () => {
    await closeHttpServer(server)
  })

  test('redirects the root path to login', async () => {
    const response = await fetch(`${baseUrl}/`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })
})

const http = require('node:http')
const path = require('node:path')
const express = require('express')

const scheduledConsultationsRouter = require('../../src/routes/scheduled_consultations')

describe('scheduled consultations route', () => {
  let server
  let baseUrl
  let sessionState

  beforeAll(async () => {
    const app = express()

    app.set('view engine', 'ejs')
    app.set('views', path.join(__dirname, '../../src/views'))
    app.use(function (req, res, next) {
      req.session = sessionState
      next()
    })
    app.use('/scheduled_consultations', scheduledConsultationsRouter)

    server = http.createServer(app)
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  beforeEach(() => {
    sessionState = {}
  })

  test('renders the placeholder page without a signed-in user', async () => {
    const response = await fetch(`${baseUrl}/scheduled_consultations`)
    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('Scheduled consultations have not been built yet.')
  })

  test('renders the placeholder page with the signed-in username', async () => {
    sessionState = {
      user: {
        username: 'alice'
      }
    }

    const response = await fetch(`${baseUrl}/scheduled_consultations`)
    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('alice')
  })
})

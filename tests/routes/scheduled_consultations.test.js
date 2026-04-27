const http = require('node:http')
const path = require('node:path')
const express = require('express')

const closeServer = async function (server) {
  if (!server) {
    return
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })

    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections()
    }

    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
  })
}
// only available to lecturers
const scheduledConsultationsRouter = require('../../src/routes/scheduled_consultations')

const createServer = async function () {
  const app = express()
  const server = http.createServer(app)

  app.set('view engine', 'ejs')
  app.set('views', path.resolve(__dirname, '../../src/views'))
  app.use((req, res, next) => {
    req.session = {
      user: {
        username: 'lecturer1'
      }
    }
    next()
  })
  app.use('/scheduled_consultations', scheduledConsultationsRouter)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return server
}

describe('scheduled consultations route', () => {
  let baseUrl
  let server

  beforeAll(async () => {
    server = await createServer()
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterAll(async () => {
    await closeServer(server)
  })

  test('renders the placeholder page', async () => {
    const response = await fetch(`${baseUrl}/scheduled_consultations`)
    const body = await response.text()

    expect(response.status).toBe(501)
    expect(body).toContain('<title>Scheduled Consultations</title>')
    expect(body).toContain('Hello lecturer1')
    expect(body).toContain('Scheduled consultations have not been built yet.')
  })
})

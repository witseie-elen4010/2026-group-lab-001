const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { connectToDatabase, closeDatabaseConnection, getCollection } = require('../../src/models/db')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

// Uses seeded student credentials from the test database
const PASSWORD = 'password'
const USERNAME = 'user'

test.describe('create consultation E2E', () => {
  test.skip(!process.env.MONGODB_URI, 'Requires a writable MongoDB test database.')

  let createdConsultationId

  test.afterEach(async () => {
    if (!createdConsultationId) {
      return
    }

    await connectToDatabase()
    await getCollection('Consultation').deleteOne({ _id: createdConsultationId })
    createdConsultationId = null
    await closeDatabaseConnection()
  })

  test('student can create a consultation via the form', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page).toHaveURL(/\/home$/)

    await page.goto('/consultations/new')
    await expect(page.getByRole('heading', { name: 'Create Consultation' })).toBeVisible()

    const title = `E2E Consultation ${Date.now()}`
    await page.getByRole('textbox', { name: 'Title' }).fill(title)

    // select the first lecturer option (index 1 because index 0 is the placeholder)
    await page.locator('select[name="lecturerId"]').selectOption({ index: 1 })

    // pick a datetime ~24 hours in the future in datetime-local format
    const dt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const pad = (n) => String(n).padStart(2, '0')
    const dtStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    await page.locator('input[name="datetime"]').fill(dtStr)

    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Create Consultation' }).click()
    ])

    await expect(page).toHaveURL(/\/home$/)

    // verify the consultation was stored in the database
    await connectToDatabase()
    const doc = await getCollection('Consultation').findOne({ title })
    expect(doc).not.toBeNull()
    createdConsultationId = doc?._id
    await closeDatabaseConnection()
  })
})

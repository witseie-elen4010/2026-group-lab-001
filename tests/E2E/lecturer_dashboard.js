const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { connectToDatabase, closeDatabaseConnection, getCollection } = require('../../src/models/db')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const TEST_ID = `${process.pid}${Date.now()}`
const LECTURER_PASSWORD = 'password1'
const LECTURER_USERNAME = 'user1'
const STUDENT_PASSWORD = 'password'
const STUDENT_USERNAME = 'user'
const TEST_TITLE_PREFIX = 'lecturer-dashboard-e2e-'

/**
 * Logs a user in from the login page.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {object} options - Login details.
 * @param {string} options.password - Password for the seeded user.
 * @param {string} options.username - Username for the seeded user.
 * @returns {Promise<void>}
 */
const loginFromPage = async function (page, { password, username }) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Username' }).fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log In' }).click()
}

/**
 * Deletes consultations created by this E2E suite.
 * @returns {Promise<void>}
 */
const deleteTestConsultations = async function () {
  await connectToDatabase()
  await getCollection('Consultation').deleteMany({ title: { $regex: `^${TEST_TITLE_PREFIX}` } })
}

/**
 * Builds a future datetime string in the current month.
 * @param {number} offsetHours - Hours to add to the current time.
 * @returns {string} Datetime in YYYY-MM-DDTHH:MM format.
 */
const getFutureDatetime = function (offsetHours) {
  const future = new Date(Date.now() + offsetHours * 60 * 60 * 1000)
  const year = future.getFullYear()
  const month = String(future.getMonth() + 1).padStart(2, '0')
  const day = String(future.getDate()).padStart(2, '0')
  const hours = String(future.getHours()).padStart(2, '0')
  const minutes = String(future.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

test.describe('lecturer dashboard E2E', () => {
  test.skip(!process.env.MONGODB_URI, 'Requires a writable MongoDB test database.')

  test.beforeEach(async function () {
    await deleteTestConsultations()
  })

  test.afterEach(async function () {
    await deleteTestConsultations()
  })

  test.afterAll(async function () {
    await deleteTestConsultations()
    await closeDatabaseConnection()
  })

  test('lecturer dashboard shows upcoming consultations in the list and calendar', async ({ page }) => {
    const visibleTitle = `${TEST_TITLE_PREFIX}visible-${TEST_ID}`
    const hiddenTitle = `${TEST_TITLE_PREFIX}hidden-${TEST_ID}`
    const datetime = getFutureDatetime(24)

    await connectToDatabase()
    const users = getCollection('User')
    const seededStudent = await users.findOne({ username: 'user' })

    if (!seededStudent) {
      throw new Error('Seeded student user for lecturer dashboard E2E tests was not found.')
    }

    const rosterAttendeeName = `${seededStudent.firstName || ''} ${seededStudent.lastName || ''}`.trim() || seededStudent.username

    await getCollection('Consultation').insertMany([
      {
        attendees: [seededStudent.username],
        capacity: 1,
        datetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'dashboard-student',
        title: visibleTitle
      },
      {
        attendees: ['student2'],
        capacity: 1,
        datetime,
        lecturerId: 'other-lecturer',
        organiserId: 'dashboard-student',
        title: hiddenTitle
      }
    ])

    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await page.getByRole('link', { name: 'Scheduled Consultations' }).click()

    await expect(page).toHaveURL(/\/scheduled_consultations$/)
    await expect(page.getByRole('heading', { name: 'Lecturer Dashboard' })).toBeVisible()

    const consultationCard = page.locator('.dashboard_consultation_card').filter({ hasText: visibleTitle })
    const calendarNote = page.locator('.calendar_day_note_dashboard').filter({ hasText: visibleTitle })

    await expect(consultationCard).toBeVisible()
    await expect(consultationCard).toContainText('dashboard-student')
    await expect(consultationCard).toContainText(datetime.slice(0, 10))
    await expect(consultationCard).toContainText(datetime.slice(11, 16))
    await expect(consultationCard).toContainText('Attendee roster')
    await expect(consultationCard).toContainText(rosterAttendeeName)

    await expect(calendarNote).toBeVisible()
    await expect(calendarNote).toContainText(datetime.slice(11, 16))

    await expect(page.getByText(hiddenTitle)).toHaveCount(0)
  })

  test('student users cannot access the lecturer dashboard', async ({ page }) => {
    await loginFromPage(page, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })

    await page.goto('/scheduled_consultations')

    await expect(page).toHaveURL(/\/scheduled_consultations$/)
    await expect(page.getByText('Only lecturers can access the lecturer dashboard.')).toBeVisible()
    await expect(page.locator('.dashboard_consultation_card')).toHaveCount(0)
  })
})

'use strict'

const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { connectToDatabase, closeDatabaseConnection, getCollection } = require('../../src/models/db')
const { hashPassword } = require('../../src/utils/password')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const LECTURER_USERNAME = 'daily-summary-e2e-user'
const LECTURER_PASSWORD = 'daily-summary-e2e-pass'
const STUDENT_USERNAME = 'user'
const STUDENT_PASSWORD = 'password'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_TITLE_PREFIX = 'daily-summary-e2e-'

/**
 * Logs a user in from the login page.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {object} options - Login details.
 * @param {string} options.password - Password.
 * @param {string} options.username - Username.
 * @returns {Promise<void>}
 */
const loginFromPage = async function (page, { password, username }) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Username' }).fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log In' }).click()
}

/**
 * Builds a datetime string for today at the given hour and minute.
 * @param {number} hours - Hour (0-23).
 * @param {number} [minutes=0] - Minute (0-59).
 * @returns {string} Datetime in YYYY-MM-DDTHH:MM format.
 */
const getTodayDatetime = function (hours, minutes = 0) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  return `${year}-${month}-${day}T${hh}:${mm}`
}

/**
 * Deletes consultations created by this E2E suite and any pre-existing
 * consultations for the test lecturer scheduled today (to prevent stale data
 * from creating unexpected time slots).
 * @returns {Promise<void>}
 */
const deleteTestConsultations = async function () {
  const todayDatetime = getTodayDatetime(0, 0)
  const todayPrefix = todayDatetime.slice(0, 10)
  await connectToDatabase()
  await Promise.all([
    getCollection('Consultation').deleteMany({ title: { $regex: `^${TEST_TITLE_PREFIX}` } }),
    getCollection('Consultation').deleteMany({
      lecturerId: LECTURER_USERNAME,
      datetime: { $gte: `${todayPrefix}T00:00`, $lt: `${todayPrefix}T23:59~` }
    })
  ])
}

test.describe('daily summary E2E', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!process.env.MONGODB_URI, 'Requires a writable MongoDB test database.')

  test.beforeAll(async function () {
    await connectToDatabase()
    const passwordHash = await hashPassword(LECTURER_PASSWORD)
    await getCollection('User').updateOne(
      { username: LECTURER_USERNAME },
      {
        $setOnInsert: {
          email: `${LECTURER_USERNAME}@test.local`,
          facultyId: 'Test Faculty',
          firstName: 'DailySummary',
          lastName: 'E2EUser',
          passwordHash,
          role: 'lecturer',
          schoolId: 'Test School',
          universityId: 'Test University',
          username: LECTURER_USERNAME
        }
      },
      { upsert: true }
    )
  })

  test.beforeEach(async function () {
    await deleteTestConsultations()
  })

  test.afterEach(async function () {
    await deleteTestConsultations()
  })

  test.afterAll(async function () {
    await deleteTestConsultations()
    await getCollection('User').deleteOne({ username: LECTURER_USERNAME })
    await closeDatabaseConnection()
  })

  test('lecturer home page shows a Daily Summary link', async ({ page }) => {
    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole('link', { name: 'Daily Summary' })).toBeVisible()
  })

  test('clicking Daily Summary navigates to the daily summary page', async ({ page }) => {
    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await page.getByRole('link', { name: 'Daily Summary' }).click()

    await expect(page).toHaveURL(/\/daily_summary$/)
    await expect(page.getByRole('heading', { name: 'Daily Summary' })).toBeVisible()
  })

  test('daily summary page shows no consultations when none are scheduled today', async ({ page }) => {
    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await page.goto('/daily_summary')

    await expect(page).toHaveURL(/\/daily_summary$/)
    await expect(page.getByText('No consultations scheduled for today.')).toBeVisible()
  })

  test('daily summary lists today\'s consultations grouped by time slot', async ({ page }) => {
    const earlyDatetime = getTodayDatetime(9, 0)
    const lateDatetime = getTodayDatetime(14, 0)
    const earlyTitle = `${TEST_TITLE_PREFIX}early-${TEST_ID}`
    const earlyTitle2 = `${TEST_TITLE_PREFIX}early2-${TEST_ID}`
    const lateTitle = `${TEST_TITLE_PREFIX}late-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertMany([
      {
        attendees: [],
        capacity: 5,
        datetime: earlyDatetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser1',
        title: earlyTitle
      },
      {
        attendees: [],
        capacity: 5,
        datetime: earlyDatetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser2',
        title: earlyTitle2
      },
      {
        attendees: [],
        capacity: 5,
        datetime: lateDatetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser3',
        title: lateTitle
      }
    ])

    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await page.goto('/daily_summary')

    await expect(page.getByText(earlyTitle)).toBeVisible()
    await expect(page.getByText(earlyTitle2)).toBeVisible()
    await expect(page.getByText(lateTitle)).toBeVisible()

    const timeSlots = page.locator('.daily_summary_slot')
    await expect(timeSlots).toHaveCount(2)

    const firstSlot = timeSlots.first()
    await expect(firstSlot.locator('.daily_summary_slot_heading')).toContainText('09:00')
    await expect(firstSlot.getByText(earlyTitle)).toBeVisible()
    await expect(firstSlot.getByText(earlyTitle2)).toBeVisible()
  })

  test('daily summary does not show consultations belonging to other lecturers', async ({ page }) => {
    const datetime = getTodayDatetime(10, 0)
    const ownTitle = `${TEST_TITLE_PREFIX}own-${TEST_ID}`
    const otherTitle = `${TEST_TITLE_PREFIX}other-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertMany([
      {
        attendees: [],
        capacity: 5,
        datetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser1',
        title: ownTitle
      },
      {
        attendees: [],
        capacity: 5,
        datetime,
        lecturerId: 'other-lecturer',
        organiserId: 'organiser2',
        title: otherTitle
      }
    ])

    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await page.goto('/daily_summary')

    await expect(page.getByText(ownTitle)).toBeVisible()
    await expect(page.getByText(otherTitle)).toHaveCount(0)
  })

  test('student users cannot access the daily summary page', async ({ page }) => {
    await loginFromPage(page, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })

    await page.goto('/daily_summary')

    await expect(page).toHaveURL(/\/daily_summary$/)
    await expect(page.getByText('Only lecturers can access the daily summary.')).toBeVisible()
  })

  test('daily summary page has a link back to home', async ({ page }) => {
    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await page.goto('/daily_summary')

    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/home$/)
  })
})

const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { connectToDatabase, closeDatabaseConnection, getCollection } = require('../../src/models/db')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const PASSWORD = 'password'
const STUDENT_USERNAME = 'user'
const LECTURER_USERNAME = 'user1'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_TITLE_PREFIX = 'home-calendar-e2e-'

const deleteTestConsultations = async function () {
  await connectToDatabase()
  await getCollection('Consultation').deleteMany({ title: { $regex: `^${TEST_TITLE_PREFIX}` } })
}

const getFutureCurrentMonthDatetime = function () {
  const future = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const year = future.getFullYear()
  const month = String(future.getMonth() + 1).padStart(2, '0')
  const day = String(future.getDate()).padStart(2, '0')
  const hours = String(future.getHours()).padStart(2, '0')
  const minutes = String(future.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

test.describe('home calendar E2E', () => {
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

  test('student home calendar shows joined, unjoined, and fully booked consultations', async ({ page }) => {
    const datetime = getFutureCurrentMonthDatetime()
    const joinedTitle = `${TEST_TITLE_PREFIX}joined-${TEST_ID}`
    const unjoinedTitle = `${TEST_TITLE_PREFIX}unjoined-${TEST_ID}`
    const fullTitle = `${TEST_TITLE_PREFIX}full-${TEST_ID}`

    await connectToDatabase()
    await getCollection('Consultation').insertMany([
      {
        attendees: [STUDENT_USERNAME],
        capacity: 5,
        datetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: STUDENT_USERNAME,
        title: joinedTitle
      },
      {
        attendees: [],
        capacity: 5,
        datetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'organiser1',
        title: unjoinedTitle
      },
      {
        attendees: ['student2'],
        capacity: 1,
        datetime,
        lecturerId: LECTURER_USERNAME,
        organiserId: 'student2',
        title: fullTitle
      }
    ])

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill(STUDENT_USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page).toHaveURL(/\/home$/)

    const joinedNote = page.locator('.calendar_day_note_joined').filter({ hasText: joinedTitle })
    const unjoinedNote = page.locator('.calendar_day_note_unjoined').filter({ hasText: unjoinedTitle })
    const fullNote = page.locator('.calendar_day_note_full').filter({ hasText: fullTitle })

    await expect(joinedNote).toBeVisible()
    await expect(unjoinedNote).toBeVisible()
    await expect(fullNote).toBeVisible()

    await expect(joinedNote).toContainText('Joined')
    await expect(unjoinedNote).toContainText('Unjoined')
    await expect(fullNote).toContainText('Fully Booked')
  })
})

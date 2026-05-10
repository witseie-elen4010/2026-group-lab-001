const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { connectToDatabase, closeDatabaseConnection, getCollection } = require('../../src/models/db')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const SEEDED_STUDENT_USERNAME = 'user'
const SEEDED_LECTURER_USERNAME = 'user1'
const LECTURER_PASSWORD = 'password1'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_STUDENT_USERNAME = `e2estud${TEST_ID}lectcancel`
const TEST_LECTURER_USERNAME = `e2elect${TEST_ID}lectcancel`

test.describe('lecturer cancel consultation E2E', () => {
  test.skip(!process.env.MONGODB_URI, 'Requires a writable MongoDB test database.')

  const futureDatetime = function () {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    date.setHours(9, 0, 0, 0)
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:00`
  }

  const loginAsLecturer = async function (page) {
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill(TEST_LECTURER_USERNAME)
    await page.getByLabel('Password').fill(LECTURER_PASSWORD)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).toHaveURL(/\/home$/)
  }

  test.beforeAll(async function () {
    await connectToDatabase()
    const users = await getCollection('User')
    const seededStudent = await users.findOne({ username: SEEDED_STUDENT_USERNAME })
    const seededLecturer = await users.findOne({ username: SEEDED_LECTURER_USERNAME })

    if (!seededStudent || !seededLecturer) {
      throw new Error('Seeded users for lecturer cancel consultation E2E tests were not found.')
    }

    const { _id: _sid, username: _su, email: _se, ...studentFields } = seededStudent
    const { _id: _lid, username: _lu, email: _le, ...lecturerFields } = seededLecturer

    await users.deleteMany({ username: { $in: [TEST_STUDENT_USERNAME, TEST_LECTURER_USERNAME] } })
    await users.insertMany([
      { ...studentFields, email: `${TEST_STUDENT_USERNAME}@example.test`, username: TEST_STUDENT_USERNAME },
      { ...lecturerFields, email: `${TEST_LECTURER_USERNAME}@example.test`, username: TEST_LECTURER_USERNAME }
    ])
  })

  test.afterEach(async function () {
    await connectToDatabase()
    await getCollection('Consultation').deleteMany({ lecturerId: TEST_LECTURER_USERNAME })
  })

  test.afterAll(async function () {
    await connectToDatabase()
    await getCollection('Consultation').deleteMany({ lecturerId: TEST_LECTURER_USERNAME })
    await getCollection('User').deleteMany({ username: { $in: [TEST_STUDENT_USERNAME, TEST_LECTURER_USERNAME] } })
    await closeDatabaseConnection()
  })

  test('Manage Consultations button is visible on the lecturer home page', async ({ page }) => {
    await loginAsLecturer(page)

    await expect(page.getByRole('button', { name: 'Manage Consultations' })).toBeVisible()
  })

  test('modal shows the consultation with a Cancel button for the assigned lecturer', async ({ page }) => {
    await connectToDatabase()
    await getCollection('Consultation').insertOne({
      attendees: [TEST_STUDENT_USERNAME],
      capacity: 1,
      datetime: futureDatetime(),
      lecturerId: TEST_LECTURER_USERNAME,
      organiserId: TEST_STUDENT_USERNAME,
      title: 'E2E Lecturer Cancel Modal Test'
    })

    await loginAsLecturer(page)
    await page.getByRole('button', { name: 'Manage Consultations' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('E2E Lecturer Cancel Modal Test')
    await expect(dialog.getByRole('button', { name: 'Cancel Consultation' })).toBeVisible()
  })

  test('confirming the cancel prompt removes the consultation from the database', async ({ page }) => {
    await connectToDatabase()
    const { insertedId } = await getCollection('Consultation').insertOne({
      attendees: [TEST_STUDENT_USERNAME],
      capacity: 1,
      datetime: futureDatetime(),
      lecturerId: TEST_LECTURER_USERNAME,
      organiserId: TEST_STUDENT_USERNAME,
      title: 'E2E Lecturer Consultation To Cancel'
    })

    await loginAsLecturer(page)
    await page.getByRole('button', { name: 'Manage Consultations' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    page.once('dialog', async function (nativeDialog) {
      await nativeDialog.accept()
    })

    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Cancel Consultation' }).click()
    ])

    await connectToDatabase()
    const remaining = await getCollection('Consultation').findOne({ _id: insertedId })
    expect(remaining).toBeNull()
  })
})

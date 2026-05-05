const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { connectToDatabase, closeDatabaseConnection, getCollection } = require('../../src/models/db')
const { setLecturerAvailability } = require('../../src/models/lecturer_availability_db')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const SEEDED_LECTURER_USERNAME = 'user1'
const PASSWORD = 'password'
const SEEDED_STUDENT_USERNAME = 'user'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_LECTURER_USERNAME = `e2elect${TEST_ID}x`
const TEST_STUDENT_USERNAME = `e2estud${TEST_ID}y`

test.describe('create consultation E2E', () => {
  test.skip(!process.env.MONGODB_URI, 'Requires a writable MongoDB test database.')

  const setLecturerSchedule = async function () {
    await connectToDatabase()
    await setLecturerAvailability(TEST_LECTURER_USERNAME, {
      dailyMax: 2,
      duration: 60,
      exceptionDates: ['2030-04-01'],
      maxStudents: 5,
      minStudents: 1,
      weeklyAvailability: [
        { day: 'monday', startTime: '09:00', endTime: '12:00' }
      ]
    })
  }

  const nextMondayAtHour = function (hour) {
    const result = new Date()
    result.setSeconds(0, 0)
    result.setMinutes(0)
    result.setHours(hour)
    result.setDate(result.getDate() + 1)

    while (result.getDay() !== 1) {
      result.setDate(result.getDate() + 1)
    }

    return result
  }

  const toDatetimeLocal = function (date) {
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const loginAndOpenCreateConsultation = async function (page) {
    await page.goto('/login')

    await page.getByRole('textbox', { name: 'Username' }).fill(TEST_STUDENT_USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page).toHaveURL(/\/home$/)

    await page.goto('/consultations/new')
    await expect(page.getByRole('heading', { name: 'Create Consultation' })).toBeVisible()
  }

  test.beforeAll(async function () {
    await connectToDatabase()
    const users = await getCollection('User')
    const seededStudent = await users.findOne({ username: SEEDED_STUDENT_USERNAME })
    const seededLecturer = await users.findOne({ username: SEEDED_LECTURER_USERNAME })

    if (!seededStudent || !seededLecturer) {
      throw new Error('Seeded users for create consultation E2E tests were not found.')
    }

    const { _id: seededStudentId, username: seededStudentUsername, email: seededStudentEmail, ...studentFields } = seededStudent
    const { _id: seededLecturerId, username: seededLecturerUsername, email: seededLecturerEmail, ...lecturerFields } = seededLecturer

    await users.deleteMany({
      username: {
        $in: [TEST_LECTURER_USERNAME, TEST_STUDENT_USERNAME]
      }
    })

    await users.insertMany([
      {
        ...studentFields,
        email: `${TEST_STUDENT_USERNAME}@example.test`,
        username: TEST_STUDENT_USERNAME
      },
      {
        ...lecturerFields,
        email: `${TEST_LECTURER_USERNAME}@example.test`,
        username: TEST_LECTURER_USERNAME
      }
    ])
  })

  test.afterEach(async () => {
    await connectToDatabase()

    await getCollection('Consultation').deleteMany({
      $or: [
        { lecturerId: TEST_LECTURER_USERNAME },
        { organiserId: TEST_STUDENT_USERNAME }
      ]
    })
    await getCollection('LecturerAvailability').deleteOne({ username: TEST_LECTURER_USERNAME })
  })

  test.afterAll(async function () {
    await connectToDatabase()
    await getCollection('Consultation').deleteMany({
      $or: [
        { lecturerId: TEST_LECTURER_USERNAME },
        { organiserId: TEST_STUDENT_USERNAME }
      ]
    })
    await getCollection('LecturerAvailability').deleteOne({ username: TEST_LECTURER_USERNAME })
    await getCollection('User').deleteMany({
      username: {
        $in: [TEST_LECTURER_USERNAME, TEST_STUDENT_USERNAME]
      }
    })
    await closeDatabaseConnection()
  })

  test('student can create a consultation via the form', async ({ page }) => {
    await setLecturerSchedule()
    await loginAndOpenCreateConsultation(page)

    const title = `E2E Consultation ${Date.now()}`
    await page.getByRole('textbox', { name: 'Title' }).fill(title)

    await page.locator('select[name="lecturerId"]').selectOption(TEST_LECTURER_USERNAME)

    await page.locator('input[name="datetime"]').fill(toDatetimeLocal(nextMondayAtHour(10)))

    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Create Consultation' }).click()
    ])

    await expect(page).toHaveURL(/\/home$/)

    // verify the consultation was stored in the database
    await connectToDatabase()
    const doc = await getCollection('Consultation').findOne({ title })
    expect(doc).not.toBeNull()
    await closeDatabaseConnection()
  })

  test('prevents overlapping consultations and shows flash message', async ({ page }) => {
    await setLecturerSchedule()
    await loginAndOpenCreateConsultation(page)

    const title1 = `E2E Consultation first ${Date.now()}`
    await page.getByRole('textbox', { name: 'Title' }).fill(title1)

    await page.locator('select[name="lecturerId"]').selectOption(TEST_LECTURER_USERNAME)

    await page.locator('input[name="datetime"]').fill(toDatetimeLocal(nextMondayAtHour(10)))

    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Create Consultation' }).click()
    ])

    await expect(page).toHaveURL(/\/home$/)

    // Attempt to create an overlapping consultation
    await loginAndOpenCreateConsultation(page)

    const title2 = `E2E Consultation second ${Date.now()}`
    await page.getByRole('textbox', { name: 'Title' }).fill(title2)
    await page.locator('select[name="lecturerId"]').selectOption(TEST_LECTURER_USERNAME)
    await page.locator('input[name="datetime"]').fill(toDatetimeLocal(nextMondayAtHour(10)))

    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Create Consultation' }).click()
    ])

    await expect(page).toHaveURL(/\/consultations\/new$/)
    await expect(page.locator('p.error')).toContainText('A consultation is already booked at')
  })
})

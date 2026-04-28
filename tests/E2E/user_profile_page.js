const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { closeDatabaseConnection, connectToDatabase, getCollection } = require('../../src/models/db')
const { getLecturerAvailability, setLecturerAvailability } = require('../../src/models/lecturer_availability_db')
const { getUser, updateUserInstitutions } = require('../../src/models/user_db')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const FACULTY_NAME = 'Engineering and the Built Environment'
const LECTURER_PASSWORD = 'password1'
const LECTURER_USERNAME = 'user1'
const SCHOOL_NAME = 'Electrical and Information Engineering'
const STUDENT_PASSWORD = 'password'
const STUDENT_USERNAME = 'user'
const UNIVERSITY_NAME = 'University of the Witwatersrand'

let originalLecturerPreferences
let originalStudentInstitutions

const loginFromPage = async function (page, { password, username }) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Username' }).fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log In' }).click()
}

const queryInstitutionField = async function (page, {
  expectedQueryFragments = [],
  fieldId,
  routeFragment,
  value
}) {
  const input = page.locator(`#${fieldId}`)
  const requiredQueryFragments = [
    new URLSearchParams({ query: value }).toString(),
    ...expectedQueryFragments
  ]
  const responsePromise = page.waitForResponse(function (response) {
    return response.request().method() === 'GET' &&
      response.url().includes(routeFragment) &&
      requiredQueryFragments.every(function (fragment) {
        return response.url().includes(fragment)
      })
  })

  await input.fill(value)

  const response = await responsePromise
  const responseBody = await response.json()

  expect(responseBody.results).toContain(value)
  requiredQueryFragments.forEach(function (fragment) {
    expect(response.url()).toContain(fragment)
  })

  await page.waitForFunction(function ({ fieldId, value }) {
    const input = document.getElementById(fieldId)
    const optionsList = document.getElementById(input.getAttribute('list'))

    return Array.from(optionsList.children).some(function (option) {
      return option.value === value
    })
  }, { fieldId, value })

  await input.blur()
}

test.describe('user profile page', () => {
  test.skip(!process.env.MONGODB_URI, 'Requires a readable MongoDB test database.')

  test.beforeAll(async function () {
    await connectToDatabase()
    const originalStudent = await getUser(STUDENT_USERNAME)

    originalStudentInstitutions = {
      facultyId: originalStudent?.facultyId || FACULTY_NAME,
      schoolId: originalStudent?.schoolId || SCHOOL_NAME,
      universityId: originalStudent?.universityId || UNIVERSITY_NAME
    }
    originalLecturerPreferences = await getLecturerAvailability(LECTURER_USERNAME)
  })

  test.afterEach(async function () {
    await connectToDatabase()
    await updateUserInstitutions(STUDENT_USERNAME, originalStudentInstitutions)

    if (originalLecturerPreferences) {
      await setLecturerAvailability(LECTURER_USERNAME, originalLecturerPreferences)
      return
    }

    await getCollection('LecturerAvailability').deleteOne({ username: LECTURER_USERNAME })
  })

  test.afterAll(async function () {
    await closeDatabaseConnection()
  })

  test('shows the seeded student profile after navigating from the home page', async ({ page }) => {
    await loginFromPage(page, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })

    await page.getByRole('link', { name: 'User Profile' }).click()

    await expect(page).toHaveURL(/\/user_profile\?user=user$/)
    await expect(page.getByRole('heading', { name: `Hello, ${STUDENT_USERNAME}` })).toBeVisible()
    await expect(page.getByText('test@email.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update Institution' })).toBeVisible()
    await expect(page.getByText('Consultation Preferences')).toHaveCount(0)
  })

  test('shows consultation preferences for the seeded lecturer profile after navigating from the home page', async ({ page }) => {
    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await page.getByRole('link', { name: 'User Profile' }).click()

    await expect(page).toHaveURL(/\/user_profile\?user=user1$/)
    await expect(page.getByRole('heading', { name: `Hello, ${LECTURER_USERNAME}` })).toBeVisible()
    await expect(page.getByText('123456@students.wits.ac.za')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Consultation Preferences' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Consultation Preferences' })).toBeVisible()
  })

  test('updates institution details from the seeded student profile page', async ({ page }) => {
    await connectToDatabase()
    await updateUserInstitutions(STUDENT_USERNAME, {
      facultyId: 'unassigned',
      schoolId: 'unassigned',
      universityId: 'unassigned'
    })

    await loginFromPage(page, {
      password: STUDENT_PASSWORD,
      username: STUDENT_USERNAME
    })

    await page.getByRole('link', { name: 'User Profile' }).click()

    await queryInstitutionField(page, {
      fieldId: 'profile_university',
      routeFragment: '/institutions/universities',
      value: UNIVERSITY_NAME
    })
    await queryInstitutionField(page, {
      expectedQueryFragments: ['university=University+of+the+Witwatersrand'],
      fieldId: 'profile_faculty',
      routeFragment: '/institutions/faculties',
      value: FACULTY_NAME
    })
    await queryInstitutionField(page, {
      expectedQueryFragments: [
        'university=University+of+the+Witwatersrand',
        'faculty=Engineering+and+the+Built+Environment'
      ],
      fieldId: 'profile_school',
      routeFragment: '/institutions/schools',
      value: SCHOOL_NAME
    })

    await Promise.all([
      page.waitForResponse(function (response) {
        return response.request().method() === 'POST' && response.url().includes('/user_profile?user=user')
      }),
      page.getByRole('button', { name: 'Update Institution' }).click()
    ])

    const updatedStudent = await getUser(STUDENT_USERNAME)

    expect(updatedStudent).toEqual(expect.objectContaining({
      facultyId: FACULTY_NAME,
      schoolId: SCHOOL_NAME,
      universityId: UNIVERSITY_NAME
    }))
  })

  test('saves consultation preferences from the seeded lecturer profile page', async ({ page }) => {
    await loginFromPage(page, {
      password: LECTURER_PASSWORD,
      username: LECTURER_USERNAME
    })

    await page.getByRole('link', { name: 'User Profile' }).click()

    await page.locator('input[name="minStudents"]').fill('1')
    await page.locator('input[name="maxStudents"]').fill('3')
    await page.locator('input[name="duration"]').fill('45')
    await page.locator('input[name="dailyMax"]').fill('2')
    await page.locator('select[name="availability_monday"]').selectOption('available')
    await page.locator('input[name="start_time_monday"]').fill('10:00')
    await page.locator('input[name="end_time_monday"]').fill('11:00')
    await page.locator('textarea[name="exceptionDates"]').fill('2026-11-10\n2026-11-11')

    await Promise.all([
      page.waitForResponse(function (response) {
        return response.request().method() === 'POST' && response.url().includes('/user_profile?user=user1')
      }),
      page.getByRole('button', { name: 'Save Consultation Preferences' }).click()
    ])

    await expect(page.getByText('Consultation preferences saved successfully.')).toBeVisible()

    const savedPreferences = await getLecturerAvailability(LECTURER_USERNAME)

    expect(savedPreferences).toEqual(expect.objectContaining({
      dailyMax: 2,
      duration: 45,
      exceptionDates: ['2026-11-10', '2026-11-11'],
      maxStudents: 3,
      minStudents: 1,
      username: LECTURER_USERNAME,
      weeklyAvailability: [
        { day: 'monday', startTime: '10:00', endTime: '11:00' }
      ]
    }))
  })
})

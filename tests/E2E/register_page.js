const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { closeDatabaseConnection, connectToDatabase } = require('../../src/models/db')
const { deleteUser } = require('../../src/models/user_db')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const FACULTY_NAME = 'Engineering and the Built Environment'
const PASSWORD = 'SD3andIareBFFs'
const SCHOOL_NAME = 'Electrical and Information Engineering'
const UNIVERSITY_NAME = 'University of the Witwatersrand'

let createdUsername = ''

const queryInstitutionField = async function (page, {
  expectedQueryFragments = [],
  fieldId,
  routeFragment,
  value
}) {
  const input = page.locator(`#${fieldId}`)
  const inputElement = await input.elementHandle()

  // Wait for the page to send the institution search request. Using request
  // is more robust across browsers than waiting for the response.
  const requestPromise = page.waitForRequest(function (request) {
    return request.method() === 'GET' && request.url().includes(routeFragment)
  })

  await input.fill(value)

  const request = await requestPromise

  expectedQueryFragments.forEach(function (fragment) {
    expect(request.url()).toContain(fragment)
  })

  // Ensure the datalist was populated with the expected option
  await page.waitForFunction(function ({ fieldId, value }) {
    const input = document.getElementById(fieldId)
    const optionsList = document.getElementById(input.getAttribute('list'))

    return optionsList && Array.from(optionsList.children).some(function (option) {
      return option.value === value
    })
  }, { fieldId, value })

  await input.blur()
}

test.describe('register page', () => {
  test.skip(!process.env.MONGODB_URI, 'Requires a writable MongoDB test database.')

  test.afterAll(async function () {
    if (!createdUsername) {
      return
    }

    await connectToDatabase()
    await deleteUser(createdUsername)
    await closeDatabaseConnection()
  })

  test('queries institution suggestions and redirects to the login page after registering', async ({ page }) => {
    const username = `e2e_register_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    createdUsername = username

    await page.goto('/register')

    await page.getByRole('textbox', { name: 'Username' }).fill(username)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('textbox', { name: 'Email Address' }).fill(`${username}@students.wits.ac.za`)
    await page.getByRole('textbox', { name: 'First Name(s)' }).fill('E2E')
    await page.getByRole('textbox', { name: 'Last Name' }).fill('Register')
    await page.locator('#role').selectOption('student')

    await queryInstitutionField(page, {
      fieldId: 'university',
      routeFragment: '/institutions/universities',
      value: UNIVERSITY_NAME
    })
    await queryInstitutionField(page, {
      expectedQueryFragments: ['university=University+of+the+Witwatersrand'],
      fieldId: 'faculty',
      routeFragment: '/institutions/faculties',
      value: FACULTY_NAME
    })
    await queryInstitutionField(page, {
      expectedQueryFragments: [
        'university=University+of+the+Witwatersrand',
        'faculty=Engineering+and+the+Built+Environment'
      ],
      fieldId: 'school',
      routeFragment: '/institutions/schools',
      value: SCHOOL_NAME
    })

    await page.getByRole('button', { name: 'Register' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible()
  })
})

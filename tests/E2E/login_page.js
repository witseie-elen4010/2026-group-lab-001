const path = require('node:path')
const { test, expect } = require('@playwright/test')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

// from example User document on Atlas
const PASSWORD = 'password'
const USERNAME = 'user'

test.describe('login page', () => {
  test.skip(!process.env.MONGODB_URI, 'Requires a writable MongoDB test database.')

  test('logs in with the seeded admin user and reaches the home page', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole('heading', { name: 'Admin Home' })).toBeVisible()
    await expect(page.getByText(`Hello ${USERNAME}`)).toBeVisible()
    await expect(page.getByText('You are logged in as a admin.')).toBeVisible()
  })
})

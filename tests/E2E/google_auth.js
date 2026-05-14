const path = require('node:path')
const { test, expect } = require('@playwright/test')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

test.describe('Google auth UI', () => {
  test.skip(!process.env.MONGODB_URI, 'Requires a writable MongoDB test database.')

  test('login page shows the Sign in with Google button', async ({ page }) => {
    await page.goto('/login')

    const googleLink = page.getByRole('link', { name: /sign in with google/i })
    await expect(googleLink).toBeVisible()
    await expect(googleLink).toHaveAttribute('href', '/auth/google')
  })

  test('register page shows the Register with Google button', async ({ page }) => {
    await page.goto('/register')

    const googleLink = page.getByRole('link', { name: /register with google/i })
    await expect(googleLink).toBeVisible()
    await expect(googleLink).toHaveAttribute('href', '/auth/google')
  })

  test('/register/complete redirects to /register when accessed without a Google session', async ({ page }) => {
    await page.goto('/register/complete')

    await expect(page).toHaveURL(/\/register$/)
  })
})

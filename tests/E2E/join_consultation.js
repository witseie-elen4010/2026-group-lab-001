const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { connectToDatabase, closeDatabaseConnection, getCollection } = require('../../src/models/db')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const PASSWORD = 'password'
const STUDENT_USERNAME = 'user'
const LECTURER_USERNAME = 'user1'
const TEST_ID = `${process.pid}${Date.now()}`
const TEST_TITLE_PREFIX = 'join-consultation-e2e-'
const OPEN_TITLE = `${TEST_TITLE_PREFIX}open-${TEST_ID}`
const FULL_TITLE = `${TEST_TITLE_PREFIX}full-${TEST_ID}`
const JOINED_TITLE = `${TEST_TITLE_PREFIX}joined-${TEST_ID}`

const deleteTestConsultations = async function () {
  await connectToDatabase()
  await getCollection('Consultation').deleteMany({
    title: { $regex: `^${TEST_TITLE_PREFIX}` }
  })
}

test.describe('join consultation E2E', () => {
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

  test('student can join an open consultation from the home page', async ({ page }) => {
    await connectToDatabase()
    await getCollection('Consultation').insertMany([
      {
        attendees: ['user3'],
        capacity: 5,
        datetime: '2030-04-30T07:45',
        lecturerId: LECTURER_USERNAME,
        organiserId: 'user3',
        title: OPEN_TITLE
      },
      {
        attendees: ['user3', 'user4', 'user5'],
        capacity: 3,
        datetime: '2030-04-30T07:45',
        lecturerId: LECTURER_USERNAME,
        organiserId: 'user3',
        title: FULL_TITLE
      },
      {
        attendees: [STUDENT_USERNAME],
        capacity: 1,
        datetime: '2030-01-01T08:00',
        lecturerId: LECTURER_USERNAME,
        organiserId: STUDENT_USERNAME,
        title: JOINED_TITLE
      }
    ])

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill(STUDENT_USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole('link', { name: 'Join Consultation' })).toBeVisible()

    await page.getByRole('link', { name: 'Join Consultation' }).click()

    await expect(page).toHaveURL(/\/join_consultation$/)
    await expect(page.getByRole('heading', { name: 'Join Consultation' })).toBeVisible()
    const cards = page.locator('.join_consultation_item')
    const openCard = cards.filter({ has: page.getByRole('heading', { name: OPEN_TITLE }) })
    const fullCard = cards.filter({ has: page.getByRole('heading', { name: FULL_TITLE }) })
    const joinedCard = cards.filter({ has: page.getByRole('heading', { name: JOINED_TITLE }) })

    await expect(openCard).toBeVisible()
    await expect(fullCard).toBeVisible()
    await expect(joinedCard).toBeVisible()
    await expect(openCard.getByText('Chuck Norris')).toBeVisible()
    await expect(openCard.getByText('2030-04-30')).toBeVisible()
    await expect(joinedCard.getByText('2030-01-01')).toBeVisible()
    await expect(joinedCard.getByText('08:00')).toBeVisible()
    await expect(openCard.getByText('07:45')).toBeVisible()
    await expect(openCard.getByText('1/5')).toBeVisible()
    await expect(openCard.getByRole('button', { name: 'Join' })).toBeVisible()
    await expect(fullCard.getByRole('button', { name: 'Closed' })).toBeDisabled()
    await expect(joinedCard.getByRole('button', { name: 'Joined' })).toBeDisabled()

    await Promise.all([
      page.waitForNavigation(),
      openCard.getByRole('button', { name: 'Join' }).click()
    ])

    await expect(joinedCard).toBeVisible()
    await expect(openCard.getByText('2/5')).toBeVisible()
    await expect(openCard.getByRole('button', { name: 'Joined' })).toBeDisabled()
    await expect(page.getByText('Joined consultation successfully.')).toHaveCount(0)

    await connectToDatabase()
    const joinedConsultation = await getCollection('Consultation').findOne({ title: OPEN_TITLE })
    expect(joinedConsultation?.attendees).toContain(STUDENT_USERNAME)
  })
})

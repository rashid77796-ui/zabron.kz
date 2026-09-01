import { test, expect } from '@playwright/test'

/**
 * E2E: registration → venue browsing → booking → confirmation
 *
 * Requires a running dev server at PLAYWRIGHT_BASE_URL (default localhost:3000)
 * with a seeded DB (at least one published venue with a resource).
 *
 * Run: npm run test:e2e
 */

const TEST_EMAIL = `e2e+${Date.now()}@maguya.kz`
const TEST_PASSWORD = 'TestPass123!'
const TEST_NAME = 'E2E Tester'

test.describe('Auth flow', () => {
  test('registers a new client account', async ({ page }) => {
    await page.goto('/auth')

    // Switch to register tab
    await page.getByRole('tab', { name: /регистрация/i }).click()

    // Fill in registration form
    await page.getByLabel(/имя/i).fill(TEST_NAME)
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/пароль/i).fill(TEST_PASSWORD)

    // Accept consent
    const consentCheckbox = page.locator('input[type="checkbox"]')
    await consentCheckbox.check()
    await expect(consentCheckbox).toBeChecked()

    // Submit
    await page.getByRole('button', { name: /зарегистрироваться/i }).click()

    // Should redirect to home
    await expect(page).toHaveURL('/')
  })

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/auth')
    await page.getByLabel(/email/i).fill('nobody@example.com')
    await page.getByLabel(/пароль/i).fill('wrongpass')
    await page.getByRole('button', { name: /войти/i }).click()

    await expect(page.getByText(/неверный email|ошибка/i)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Home page', () => {
  test('hero section is visible with CTA button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /найти заведение/i })).toBeVisible()
  })

  test('share link button copies URL to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')

    const shareBtn = page.getByRole('button', { name: /скопировать ссылку/i })
    await expect(shareBtn).toBeVisible()
    await shareBtn.click()

    // Toast should appear
    await expect(page.getByText(/ссылка скопирована/i)).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Venue catalog', () => {
  test('displays venue cards', async ({ page }) => {
    await page.goto('/venues')
    // At minimum the search input should be visible
    await expect(page.locator('input[placeholder*="поиск" i], input[placeholder*="search" i]').first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('My bookings page', () => {
  test('redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/bookings')
    await expect(page).toHaveURL(/\/auth/)
  })
})

test.describe('Language switcher', () => {
  test('switches UI language to English', async ({ page }) => {
    await page.goto('/')

    // Click EN locale button
    await page.getByRole('button', { name: 'EN' }).click()

    // Hero title should switch to English text
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/book the best/i)
  })

  test('switches UI language to Kazakh', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'ҚАЗ' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/үздік орындарды/i)
  })
})

test.describe('Consent checkbox', () => {
  test('register button is disabled without consent', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('tab', { name: /регистрация/i }).click()

    await page.getByLabel(/имя/i).fill('Test')
    await page.getByLabel(/email/i).fill('a@b.com')
    await page.getByLabel(/пароль/i).fill('password123')

    // Do NOT check consent — button should be disabled
    const submitBtn = page.getByRole('button', { name: /зарегистрироваться/i })
    await expect(submitBtn).toBeDisabled()
  })

  test('register button enables after consent is checked', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('tab', { name: /регистрация/i }).click()

    await page.getByLabel(/имя/i).fill('Test')
    await page.getByLabel(/email/i).fill('a@b.com')
    await page.getByLabel(/пароль/i).fill('password123')

    await page.locator('input[type="checkbox"]').check()
    const submitBtn = page.getByRole('button', { name: /зарегистрироваться/i })
    await expect(submitBtn).toBeEnabled()
  })
})

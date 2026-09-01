/**
 * Shared E2E helpers.
 *
 * signInAs() logs a user in via the UI form (not cookie injection) so the
 * full auth middleware stack is exercised. Credentials must exist in the
 * seeded test DB.
 */
import { Page } from '@playwright/test'

export const SEED = {
  client:  { email: 'e2e.client@zabron.test',   password: 'TestE2E123!', name: 'E2E Client' },
  client2: { email: 'e2e.client2@zabron.test',  password: 'TestE2E123!', name: 'E2E Client 2' },
  merchant:{ email: 'e2e.merchant@zabron.test', password: 'TestE2E123!', name: 'E2E Merchant' },
  admin:   { email: 'e2e.admin@zabron.test',    password: 'TestE2E123!', name: 'E2E Admin' },
}

export async function signInAs(page: Page, role: keyof typeof SEED) {
  const { email, password } = SEED[role]
  await page.goto('/auth')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/пароль/i).fill(password)
  await page.getByRole('button', { name: /войти/i }).click()
  await page.waitForURL('/')
}

export async function signOut(page: Page) {
  // Navigate to dashboard and click sign-out (or hit /api/auth/sign-out directly)
  await page.goto('/api/auth/sign-out')
  await page.waitForURL('/')
}

import { expect, Page, test } from '@playwright/test'

// Reset is not exempt from injected errors: retry until it succeeds.
async function resetOrders(page: Page) {
  for (let i = 0; i < 5; i++) {
    const res = await page.request.get('reset/orders')
    if (res.ok()) return
  }
  throw new Error('reset failed')
}

// Login is a plain mutation (not retried by the client): a user would click again.
async function login(page: Page, user = 'john.doe', password = 'password123') {
  await page.goto('login')
  await page.getByLabel('Login').fill(user)
  await page.getByLabel('Password').fill(password)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Login' }).click()
    try {
      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 })
      return
    } catch {
      // Injected 500: try again.
    }
  }
  throw new Error('login failed')
}

async function fillCard(page: Page, number: string) {
  await page.getByLabel('Card number').fill(number)
  await page.getByLabel('Expiration (MM/YY)').fill('12/30')
  await page.getByLabel('Security code').fill('123')
}

async function fillAddressManually(page: Page, line1: string) {
  await page.getByLabel('Full name').first().fill('John Doe')
  await page.getByRole('combobox', { name: 'Address line 1' }).fill(line1)
  await page.getByLabel('City').first().fill('Austin')
  await page.getByRole('combobox', { name: 'State' }).first().selectOption('TX')
  await page.getByLabel('ZIP code').first().fill('78701')
}

async function placeOrder(page: Page) {
  const button = page.getByRole('button', { name: /^Place order · \$/ })
  await expect(button).toBeEnabled()
  await button.click()
}

const thankYou = (page: Page) => page.getByRole('heading', { name: 'Thank you! Your order is placed.' })

test.beforeEach(async ({ page }) => {
  await resetOrders(page)
})

test('places an order', async ({ page }) => {
  await login(page)
  await page.goto('order')
  await page.getByRole('region', { name: 'Your cart' }).getByRole('button', { name: 'Proceed to checkout' }).click()
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()

  await page.getByLabel('Full name').first().fill('John Doe')
  await page.getByRole('combobox', { name: 'Address line 1' }).pressSequentially('congress', { delay: 50 })
  await page.getByRole('option', { name: '600 CONGRESS AVE, AUSTIN, TX 78701-3234' }).click()
  await expect(page.getByLabel('City').first()).toHaveValue('AUSTIN')

  await fillCard(page, '4242 4242 4242 4242')
  await page.getByLabel('Promo code').fill('SAVE10')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('SAVE10 · 10% off')).toBeVisible()

  await placeOrder(page)
  await expect(thankYou(page)).toBeVisible()
  await expect(page.getByText('Visa •••• 4242')).toBeVisible()
  await expect(page.getByText('600 CONGRESS AVE')).toBeVisible()

  // The header badge reflects the new, empty cart.
  await expect(page.getByRole('button', { name: 'Cart', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Back to orders' }).click()
  const placed = page.getByRole('article', { name: 'Order #order-2' })
  await expect(placed.getByText('Submitted')).toBeVisible()
  await expect(placed.getByRole('button', { name: /Increase quantity/ })).toHaveCount(0)
})

test('declined card keeps form', async ({ page }) => {
  await login(page)
  await page.goto('checkout')
  await fillAddressManually(page, '600 Congress Ave')
  await fillCard(page, '4000 0000 0000 0002')
  await placeOrder(page)
  await expect(page.getByText('Your card was declined. Try another card.')).toBeVisible()
  await expect(page.getByLabel('Full name').first()).toHaveValue('John Doe')
  await expect(page.getByLabel('Security code')).toHaveValue('')

  await fillCard(page, '4242 4242 4242 4242')
  await placeOrder(page)
  await expect(thankYou(page)).toBeVisible()
})

test('corrected address choice', async ({ page }) => {
  await login(page)
  await page.goto('checkout')
  await fillAddressManually(page, '1 main street')
  await fillCard(page, '4242 4242 4242 4242')
  await placeOrder(page)
  await expect(page.getByText('We found a more precise address')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(thankYou(page)).toBeVisible()
  await expect(page.getByText('1 MAIN ST')).toBeVisible()
})

test('jane.smith gets a new empty cart', async ({ page }) => {
  await login(page, 'jane.smith', 'password456')
  await page.goto('checkout')
  await expect(page.getByText('Your cart is empty')).toBeVisible()
})

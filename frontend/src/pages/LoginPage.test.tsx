import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage, { safeRedirect } from './LoginPage'
import { LOGIN } from '@/graphql/mutations'
import { renderWithProviders } from '@/test/render'

const loginMock = {
  request: { query: LOGIN, variables: { input: { login: 'john.doe', password: 'password123' } } },
  result: { data: { login: { __typename: 'LoginResponse', token: 't1' } } },
}

async function submit() {
  await userEvent.type(screen.getByLabelText('Login'), 'john.doe')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Login' }))
}

describe('LoginPage', () => {
  it('returns to the redirect path after login', async () => {
    const { location } = renderWithProviders(<LoginPage />, { mocks: [loginMock], route: '/login?redirect=%2Fcheckout' })
    await submit()
    await waitFor(() => expect(location.current?.pathname).toBe('/checkout'))
    expect(localStorage.getItem('auth_token')).toBe('t1')
  })

  it('ignores external redirects', async () => {
    const { location } = renderWithProviders(<LoginPage />, { mocks: [loginMock], route: '/login?redirect=%2F%2Fevil.com' })
    await submit()
    await waitFor(() => expect(location.current?.pathname).toBe('/'))
  })

  it('safeRedirect accepts only same-site paths', () => {
    expect(safeRedirect('/checkout')).toBe('/checkout')
    expect(safeRedirect('//evil.com')).toBe('/')
    expect(safeRedirect('https://evil.com')).toBe('/')
    expect(safeRedirect('/\\evil.com')).toBe('/')
    expect(safeRedirect(null)).toBe('/')
  })
})

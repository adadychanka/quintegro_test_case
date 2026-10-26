import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import RequireAuth from './RequireAuth'
import { renderWithProviders, signIn } from '@/test/render'

describe('RequireAuth', () => {
  it('R1: redirects to login with the current path', () => {
    const { location } = renderWithProviders(<RequireAuth><p>secret</p></RequireAuth>, { route: '/checkout?step=1', path: '/checkout' })
    expect(screen.queryByText('secret')).toBeNull()
    expect(location.current?.pathname).toBe('/login')
    expect(location.current?.search).toBe('?redirect=%2Fcheckout%3Fstep%3D1')
  })

  it('renders children when signed in', () => {
    signIn()
    renderWithProviders(<RequireAuth><p>secret</p></RequireAuth>, { route: '/checkout', path: '/checkout' })
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})

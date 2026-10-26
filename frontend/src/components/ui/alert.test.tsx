import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Alert } from './alert'

describe('Alert', () => {
  it('error variant is announced and styled like the login error box', () => {
    render(<Alert variant="error">Something broke</Alert>)
    const el = screen.getByRole('alert')
    expect(el).toHaveTextContent('Something broke')
    expect(el.className).toContain('bg-red-50')
    expect(el.className).toContain('border-red-200')
  })

  it('info variant uses status role', () => {
    render(<Alert variant="info" title="Heads up">Body</Alert>)
    expect(screen.getByRole('status')).toHaveTextContent('Heads up')
  })
})

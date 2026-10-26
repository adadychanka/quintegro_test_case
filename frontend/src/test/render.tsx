import React from 'react'
import { render } from '@testing-library/react'
import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { MemoryRouter, Route } from 'react-router-dom'
import { createCache } from '@/apollo/client'

export function renderWithProviders(
  ui: React.ReactElement,
  { mocks = [], route = '/', path }: { mocks?: MockedResponse[]; route?: string; path?: string } = {}
) {
  const location: { current?: { pathname: string; search: string } } = {}
  const result = render(
    <MockedProvider mocks={mocks} cache={createCache()}>
      <MemoryRouter initialEntries={[route]}>
        {path ? <Route path={path}>{ui}</Route> : ui}
        <Route
          path="*"
          render={({ location: l }) => {
            location.current = l
            return null
          }}
        />
      </MemoryRouter>
    </MockedProvider>
  )
  return { ...result, location }
}

export function signIn() {
  localStorage.setItem('auth_token', 'test-token')
}

import React, { useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { LOGIN } from '../graphql/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Only same-site paths: blocks open redirects like `//evil.com` or `/\evil.com`.
export function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}

const LoginPage: React.FC = () => {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const history = useHistory()
  const location = useLocation()

  const [loginMutation, { loading: isLoading }] = useMutation(LOGIN, {
    onCompleted: (data) => {
      localStorage.setItem('auth_token', data.login.token)
      history.push(safeRedirect(new URLSearchParams(location.search).get('redirect')))
    },
    onError: (error) => {
      setError(error.message || 'An error occurred. Please try again.')
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await loginMutation({
        variables: {
          input: { login, password }
        }
      })
    } catch (err) {
      // Error is handled by onError callback
    }
  }

  return (
    <div className="flex justify-center items-center min-h-full py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-center text-2xl font-semibold text-gray-900">Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="login" className="text-sm font-medium text-gray-700">Login</label>
              <Input
                id="login"
                autoComplete="username"
                type="text"
                placeholder="Enter your login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
              <Input
                id="password"
                autoComplete="current-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginPage

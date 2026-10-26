import React from 'react'
import { Redirect, useLocation } from 'react-router-dom'
import { isSignedIn } from '@/hooks/useCart'

// R1: pages that need a session send the user to login and back.
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()
  if (!isSignedIn()) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Redirect to={`/login?redirect=${redirect}`} />
  }
  return <>{children}</>
}

export default RequireAuth

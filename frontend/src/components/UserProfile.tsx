import React from 'react'
import { User } from 'lucide-react'
import { useHistory } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { clearDraft } from '@/lib/checkoutDraft'

const UserProfile: React.FC = () => {
  const history = useHistory()
  
  const isAuthenticated = !!localStorage.getItem('auth_token')

  const handleLogin = () => {
    history.push('/login')
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    // The checkout draft holds personal data (address, phone).
    clearDraft()
    // Force page reload to update authentication state
    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-gray-100">
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAuthenticated ? (
          <DropdownMenuItem onClick={handleLogout}>
            Logout
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={handleLogin}>
            Login
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserProfile

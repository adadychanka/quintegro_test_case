import React from 'react'
import { ShoppingCart } from 'lucide-react'
import { useHistory } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCart } from '@/hooks/useCart'

const CurrentOrder: React.FC = () => {
  const history = useHistory()
  const { cart } = useCart()
  const itemCount = cart?.itemCount ?? 0

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => history.push('/order')}
      className="text-gray-700 hover:bg-gray-100 relative"
      title="Current Order"
      aria-label={itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Cart'}
    >
      <ShoppingCart className="h-5 w-5" />
      {itemCount > 0 && (
        <Badge className="absolute -top-2 -right-2 h-5 min-w-5 justify-center rounded-full p-0 px-1 text-xs bg-blue-500 text-white">
          {itemCount}
        </Badge>
      )}
    </Button>
  )
}

export default CurrentOrder

import React, { useEffect, useState } from 'react'
import { Plus, Minus, Trash2, Loader2 } from 'lucide-react'
import { useMutation } from '@apollo/client'
import { DELETE_PRODUCT_FROM_ORDER, UPDATE_ITEM_AMOUNT } from '../graphql/cart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Alert } from '@/components/ui/alert'
import { errorCode } from '@/lib/graphqlErrors'
import type { OrderItem } from '@/types/order'

interface OrderListItemProps {
  item: OrderItem
  orderId: string
  // History orders and the checkout summary show items without controls.
  readOnly?: boolean
}

const OrderListItem: React.FC<OrderListItemProps> = ({ item, orderId, readOnly = false }) => {
  const { product, amount, price } = item
  const [draft, setDraft] = useState(String(amount))
  const [failure, setFailure] = useState<'error' | 'busy' | null>(null)

  const onError = (error: unknown) => {
    setDraft(String(amount))
    setFailure(errorCode(error) === 'CHECKOUT_IN_PROGRESS' ? 'busy' : 'error')
  }

  const [updateAmount, { loading: updating }] = useMutation(UPDATE_ITEM_AMOUNT, { onError })
  const [deleteProduct, { loading: deleting }] = useMutation(DELETE_PRODUCT_FROM_ORDER, { onError })
  const pending = updating || deleting

  // The server value wins once a request finishes.
  useEffect(() => {
    if (!pending) setDraft(String(amount))
  }, [amount, pending])

  const commitAmount = (next: number) => {
    const clamped = Math.max(1, Math.min(10, Math.round(next)))
    setDraft(String(clamped))
    if (Number.isNaN(next) || clamped === amount) {
      setDraft(String(amount))
      return
    }
    setFailure(null)
    void updateAmount({ variables: { orderId, productId: product.id, amount: clamped } })
  }

  const handleDelete = () => {
    setFailure(null)
    void deleteProduct({ variables: { orderId, productId: product.id } })
  }

  return (
    <div>
      <Card className="mb-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-blue-50 border-gray-200" aria-busy={pending}>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20 rounded-lg transition-transform duration-300 hover:scale-105 border border-gray-200">
              <AvatarImage src={product.image} alt={product.title} />
              <AvatarFallback className="text-lg font-semibold bg-gray-100 text-gray-600">
                {product.title.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2 transition-colors duration-300 hover:text-blue-600 text-gray-900">
                {product.title}
              </h3>
              <p className="text-sm text-gray-600">
                {product.description}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <p className="text-lg font-bold text-blue-600">
                ${price.toFixed(2)}
              </p>
              {readOnly ? (
                <p className="text-sm text-gray-600">Qty {amount}</p>
              ) : (
                <div className="flex items-center gap-2">
                  {pending && <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-label="Updating" />}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => commitAmount(amount - 1)}
                    disabled={pending || amount <= 1}
                    aria-label={`Decrease quantity of ${product.title}`}
                    className="h-9 w-9 transition-all duration-200 hover:bg-red-500 hover:text-white hover:scale-110 disabled:opacity-50 border-gray-300"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitAmount(Number(draft))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitAmount(Number(draft))
                    }}
                    min={1}
                    max={10}
                    disabled={pending}
                    aria-label={`Quantity of ${product.title}`}
                    className="w-20 text-center h-9"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => commitAmount(amount + 1)}
                    disabled={pending || amount >= 10}
                    aria-label={`Increase quantity of ${product.title}`}
                    className="h-9 w-9 transition-all duration-200 hover:bg-green-500 hover:text-white hover:scale-110 disabled:opacity-50 border-gray-300"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDelete}
                    disabled={pending}
                    aria-label={`Remove ${product.title}`}
                    className="h-9 w-9 transition-all duration-200 text-red-600 hover:bg-red-500 hover:text-white hover:scale-110 border-gray-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {failure === 'error' && (
        <Alert variant="error" className="-mt-2 mb-4">Couldn't update this item. Try again.</Alert>
      )}
      {failure === 'busy' && (
        <Alert variant="info" className="-mt-2 mb-4">Checkout in progress. Try again in a moment.</Alert>
      )}
    </div>
  )
}

export default OrderListItem

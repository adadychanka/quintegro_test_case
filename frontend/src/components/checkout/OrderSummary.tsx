import React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { formatUsd } from '@/lib/money'
import type { OrderItem, Pricing } from '@/types/order'

export type SummaryState = 'pending-address' | 'loading' | 'error' | 'ready'

interface OrderSummaryProps {
  items: OrderItem[]
  pricing?: Pricing
  state: SummaryState
  onRetry: () => void
}

const Amount: React.FC<{ loading: boolean; children: React.ReactNode }> = ({ loading, children }) =>
  loading ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-label="Updating total" /> : <span>{children}</span>

// States Q1–Q4.
const OrderSummary: React.FC<OrderSummaryProps> = ({ items, pricing, state, onRetry }) => {
  const loading = state === 'loading' || !pricing
  const row = 'flex items-center justify-between text-sm text-gray-700'

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.product.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-gray-900">
                {item.product.title} <span className="text-gray-600">× {item.amount}</span>
              </span>
              <span className="font-medium text-gray-900">{formatUsd(Math.round(item.price * 100) * item.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {state === 'error' ? (
        <Alert
          variant="error"
          action={
            <Button variant="outline" className="h-9 border-gray-300" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          We couldn't update your total.
        </Alert>
      ) : (
        <dl className="space-y-2 border-t border-gray-200 pt-4">
          <div className={row}>
            <dt>Subtotal</dt>
            <dd>
              <Amount loading={loading}>{pricing && formatUsd(pricing.subtotalCents)}</Amount>
            </dd>
          </div>
          {pricing && pricing.discountCents > 0 && (
            <div className={row}>
              <dt>Discount{pricing.promoCode ? ` (${pricing.promoCode})` : ''}</dt>
              <dd className="text-green-700">
                <Amount loading={loading}>−{formatUsd(pricing.discountCents)}</Amount>
              </dd>
            </div>
          )}
          <div className={row}>
            <dt>Shipping</dt>
            <dd>Free</dd>
          </div>
          <div className={row}>
            <dt>{pricing?.taxStatus === 'estimated' ? 'Estimated tax' : 'Tax'}</dt>
            <dd>
              {state === 'pending-address' ? (
                <span className="text-gray-600">Calculated after you enter your address</span>
              ) : (
                <Amount loading={loading}>{pricing && formatUsd(pricing.taxCents)}</Amount>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-lg font-bold text-gray-900">
            <dt>Total</dt>
            <dd>
              <Amount loading={loading}>{pricing && formatUsd(pricing.totalCents)}</Amount>
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}

export default OrderSummary

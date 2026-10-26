import React from 'react'
import { useQuery } from '@apollo/client'
import { Link, useHistory } from 'react-router-dom'
import { Loader2, ShoppingCart } from 'lucide-react'
import { GET_ORDERS } from '../graphql/queries'
import OrderListItem from './OrderListItem'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { useCart } from '@/hooks/useCart'
import { formatUsd } from '@/lib/money'
import type { Order, OrderStatus } from '@/types/order'

const STATUS_LABEL: Record<OrderStatus, string> = {
  created: 'In cart',
  submited: 'Submitted',
  finished: 'Finished',
}

const OrderList: React.FC = () => {
  const history = useHistory()
  const { cart, loading: cartLoading, error: cartError, refetch: refetchCart } = useCart()
  const { data, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useQuery<{ orders: Order[] }>(GET_ORDERS)

  if ((cartLoading && !cart) || (ordersLoading && !data)) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  if ((cartError && !cart) || (ordersError && !data)) {
    return (
      <Alert
        variant="error"
        className="mb-6"
        action={
          <Button
            variant="outline"
            className="h-9 border-gray-300"
            onClick={() => {
              refetchCart()
              void refetchOrders()
            }}
          >
            Try again
          </Button>
        }
      >
        We couldn't load your orders.
      </Alert>
    )
  }

  const historyOrders = (data?.orders ?? []).filter((o) => o.status !== 'created')
  const items = cart?.products ?? []

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        Your Orders
      </h1>

      <section aria-labelledby="cart-heading" className="mb-10 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 id="cart-heading" className="text-xl font-semibold mb-6 text-gray-900 border-b border-gray-200 pb-3">
          Your cart
        </h2>

        {items.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
            <p className="mt-4 text-xl font-semibold text-gray-900">Your cart is empty</p>
            <p className="mt-2 text-gray-600">Products you add will show up here.</p>
          </div>
        ) : (
          items.map((item) => <OrderListItem key={item.product.id} item={item} orderId={cart!.orderId} />)
        )}

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-bold text-gray-900">
            Subtotal: <span>{formatUsd(cart?.subtotalCents ?? 0)}</span>
          </p>
          <Button
            onClick={() => history.push('/checkout')}
            disabled={items.length === 0}
            className="h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Proceed to checkout
          </Button>
        </div>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-xl font-semibold mb-6 text-gray-900">
          Order history
        </h2>
        {historyOrders.length === 0 ? (
          <p className="text-gray-600">You haven't placed any orders yet.</p>
        ) : (
          historyOrders.map((order) => (
            <article
              key={order.orderId}
              aria-labelledby={`order-${order.orderId}`}
              className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-3">
                <h3 id={`order-${order.orderId}`} className="text-xl font-semibold text-gray-900">
                  Order #{order.orderId}
                </h3>
                <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
              </div>
              {order.products.map((item) => (
                <OrderListItem key={item.product.id} item={item} orderId={order.orderId} readOnly />
              ))}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-lg font-bold text-gray-900">
                  Total: <span>{formatUsd(order.pricing?.totalCents ?? order.subtotalCents)}</span>
                </p>
                {order.pricing && (
                  <Button asChild variant="outline" className="h-11 border-gray-300">
                    <Link to={`/checkout/confirmation/${order.orderId}`}>View details</Link>
                  </Button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}

export default OrderList

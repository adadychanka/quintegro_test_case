import React from 'react'
import { useQuery } from '@apollo/client'
import { Redirect, useHistory, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, PackageX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import OrderListItem from '@/components/OrderListItem'
import OrderSummary from '@/components/checkout/OrderSummary'
import { GET_ORDER } from '@/graphql/queries'
import { errorCode } from '@/lib/graphqlErrors'
import { brandLabel } from '@/lib/mockCardTokenizer'
import { formatAddressLines, formatPhoneDisplay } from '@/lib/usAddress'
import type { Order } from '@/types/order'

const sectionTitle = 'text-xl font-semibold text-gray-900'
const primaryButton = 'h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium'

// States K1–K5.
const CheckoutConfirmationPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const { data, loading, error, refetch } = useQuery<{ order: Order }>(GET_ORDER, {
    variables: { orderId },
    errorPolicy: 'none',
    notifyOnNetworkStatusChange: true,
  })
  const order = data?.order

  if (loading && !order) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading your order...</p>
        </div>
      </div>
    )
  }

  const backToOrders = (
    <Button className={primaryButton} onClick={() => history.push('/order')}>
      Back to orders
    </Button>
  )

  if (!order && errorCode(error) === 'ORDER_NOT_FOUND') {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <PackageX className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Order not found</h2>
          <p className="mt-2 mb-6 text-gray-600">This order doesn't exist or belongs to another account.</p>
          {backToOrders}
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <Alert
        variant="error"
        action={
          <Button variant="outline" className="h-9 border-gray-300" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      >
        We couldn't load your order.
      </Alert>
    )
  }

  if (order.status === 'created') return <Redirect to="/checkout" />

  const shipping = order.shippingAddress

  return (
    <div>
      <div className="mb-8 flex items-start gap-3">
        <CheckCircle2 className="mt-1 h-8 w-8 text-green-600" aria-hidden="true" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Thank you! Your order is placed.</h1>
          <p className="mt-2 text-gray-600">Order #{order.orderId}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="items-heading" className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 id="items-heading" className={`${sectionTitle} mb-6 border-b border-gray-200 pb-3`}>
            Items
          </h2>
          {order.products.map((item) => (
            <OrderListItem key={item.product.id} item={item} orderId={order.orderId} readOnly />
          ))}
        </section>

        <aside className="space-y-6 self-start">
          {shipping && (
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className={sectionTitle}>Shipping address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-gray-700">
                <p className="font-medium text-gray-900">{shipping.fullName}</p>
                {formatAddressLines(shipping).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {shipping.phone && <p>{formatPhoneDisplay(shipping.phone)}</p>}
              </CardContent>
            </Card>
          )}

          {order.paymentMethod && (
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className={sectionTitle}>Payment</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                <p>
                  {brandLabel(order.paymentMethod.brand)} •••• {order.paymentMethod.last4}
                </p>
              </CardContent>
            </Card>
          )}

          {order.pricing && (
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className={sectionTitle}>Order summary</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderSummary items={[]} pricing={order.pricing} state="ready" onRetry={() => undefined} />
              </CardContent>
            </Card>
          )}

          {backToOrders}
        </aside>
      </div>
    </div>
  )
}

export default CheckoutConfirmationPage

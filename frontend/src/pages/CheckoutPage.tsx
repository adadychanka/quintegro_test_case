import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { useHistory } from 'react-router-dom'
import { Loader2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import AddressFields from '@/components/checkout/AddressFields'
import PaymentSection from '@/components/checkout/PaymentSection'
import PromoCodeField from '@/components/checkout/PromoCodeField'
import OrderSummary from '@/components/checkout/OrderSummary'
import AddressVerificationPanel from '@/components/checkout/AddressVerificationPanel'
import { messageFor } from '@/components/checkout/errorMessages'
import { CHECKOUT_QUOTE, VALIDATE_ADDRESS } from '@/graphql/checkout'
import { useCart } from '@/hooks/useCart'
import { useCheckoutQuote } from '@/hooks/useCheckoutQuote'
import { PlaceOrderInput, usePlaceOrder } from '@/hooks/usePlaceOrder'
import { clearDraft, loadDraft, saveDraft } from '@/lib/checkoutDraft'
import { errorCode, errorDetails } from '@/lib/graphqlErrors'
import { CardField, CardForm, emptyCard, tokenizeCard, validateCard } from '@/lib/mockCardTokenizer'
import { formatUsd } from '@/lib/money'
import { AddressField, AddressForm, emptyAddress, toAddressInput, validateAddressFields } from '@/lib/usAddress'
import type { Address, AddressVerdict, Pricing } from '@/types/order'

type FieldErrors<K extends string> = Partial<Record<K, string>>
type Choice = 'suggested' | 'entered'

interface ServerErrors {
  shipping: FieldErrors<AddressField>
  billing: FieldErrors<AddressField>
}

interface SummaryLink {
  href: string
  message: string
}

const NO_SERVER_ERRORS: ServerErrors = { shipping: {}, billing: {} }
const PROMO_CODES = new Set(['PROMO_INVALID', 'PROMO_EXPIRED'])
const BLOCKING = new Set(['CART_EMPTY', 'ORDER_NOT_EDITABLE', 'ORDER_NOT_FOUND'])
const CARD_IDS: Record<CardField, string> = { number: 'card-number', expiry: 'card-expiry', cvc: 'card-cvc' }

const sectionTitle = 'text-xl font-semibold text-gray-900'
const primaryButton = 'h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium'

function splitServerErrors(details: Record<string, unknown>): ServerErrors {
  const result: ServerErrors = { shipping: {}, billing: {} }
  const list = (details.fieldErrors as { field: string; message: string }[] | undefined) ?? []
  for (const { field, message } of list) {
    if (field.startsWith('billing.')) result.billing[field.slice(8) as AddressField] = message
    else result.shipping[field as AddressField] = message
  }
  return result
}

const CheckoutPage: React.FC = () => {
  const history = useHistory()
  const client = useApolloClient()
  const { cart, loading: cartLoading, error: cartError, refetch: refetchCart } = useCart()

  const draft = useMemo(() => loadDraft(), [])
  const [shipping, setShipping] = useState<AddressForm>(draft?.shipping ?? emptyAddress())
  const [billingSame, setBillingSame] = useState(draft?.billingSameAsShipping ?? true)
  const [billing, setBilling] = useState<AddressForm>(draft?.billing ?? emptyAddress())
  const [card, setCard] = useState<CardForm>(emptyCard())
  const [promo, setPromo] = useState<{ code: string; percent: number } | undefined>(
    draft?.promoCode ? { code: draft.promoCode, percent: 0 } : undefined
  )
  const [promoError, setPromoError] = useState<'PROMO_INVALID' | 'PROMO_EXPIRED' | undefined>()

  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<ServerErrors>(NO_SERVER_ERRORS)
  const [summaryLinks, setSummaryLinks] = useState<SummaryLink[] | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [panel, setPanel] = useState<{ verdict: 'corrected' | 'undeliverable'; entered: Address; suggested?: Address | null } | null>(null)
  const [decision, setDecision] = useState<{ key: string; choice: Choice } | null>(null)
  const [declined, setDeclined] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [priceChanged, setPriceChanged] = useState<number | null>(null)
  const [blocked, setBlocked] = useState(false)

  const summaryRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const lastChoiceRef = useRef<Choice>('entered')
  const tokenRef = useRef<{ cardKey: string; token: string } | null>(null)

  const quote = useCheckoutQuote({ address: shipping, promoCode: promo?.code, skip: !cart || cart.products.length === 0 })
  const { placeOrder, status } = usePlaceOrder()

  // Q5: keep the draft (address, billing, promo; never card data) for reloads and re-login.
  useEffect(() => {
    saveDraft({ shipping, billingSameAsShipping: billingSame, billing, promoCode: promo?.code ?? '' })
  }, [shipping, billingSame, billing, promo])

  // A promo that stopped working (e.g. expired) is removed with a message.
  useEffect(() => {
    if (quote.errorCode && PROMO_CODES.has(quote.errorCode)) {
      setPromoError(quote.errorCode as 'PROMO_INVALID' | 'PROMO_EXPIRED')
      setPromo(undefined)
    }
  }, [quote.errorCode])

  useEffect(() => {
    if (summaryLinks) summaryRef.current?.focus()
  }, [summaryLinks])

  const goToLogin = () => {
    localStorage.removeItem('auth_token')
    history.push(`/login?redirect=${encodeURIComponent('/checkout')}`)
  }

  useEffect(() => {
    if (errorCode(cartError) === 'UNAUTHENTICATED') goToLogin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartError])

  if (cartLoading && !cart) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading your cart...</p>
        </div>
      </div>
    )
  }

  if (!cart) {
    return (
      <Alert
        variant="error"
        action={
          <Button variant="outline" className="h-9 border-gray-300" onClick={refetchCart}>
            Try again
          </Button>
        }
      >
        We couldn't load your cart.
      </Alert>
    )
  }

  if (cart.products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Your cart is empty</h2>
          <p className="mt-2 text-gray-600">Add products to your cart before checking out.</p>
          <Button className={`mt-6 ${primaryButton}`} onClick={() => history.push('/order')}>
            Back to orders
          </Button>
        </div>
      </div>
    )
  }

  const pricing: Pricing | undefined = quote.pricing
  const busy = verifying || status !== 'idle'
  const addressKey = JSON.stringify(toAddressInput(shipping))

  const shippingErrors = { ...(attempted ? validateAddressFields(shipping) : {}), ...serverErrors.shipping }
  const billingErrors = { ...(attempted && !billingSame ? validateAddressFields(billing) : {}), ...serverErrors.billing }
  const cardErrors: FieldErrors<CardField> = attempted ? validateCard(card) : {}

  const collectErrors = (): SummaryLink[] => {
    const links: SummaryLink[] = []
    const add = (prefix: string, errors: Record<string, string | undefined>) =>
      Object.entries(errors).forEach(([field, message]) => message && links.push({ href: `#${prefix}${field}`, message }))
    add('shipping-', { ...validateAddressFields(shipping), ...serverErrors.shipping })
    Object.entries(validateCard(card)).forEach(([f, m]) => links.push({ href: `#${CARD_IDS[f as CardField]}`, message: m! }))
    if (!billingSame) add('billing-', { ...validateAddressFields(billing), ...serverErrors.billing })
    return links
  }

  const paymentToken = () => {
    const cardKey = `${card.number}|${card.expiry}|${card.cvc}`
    if (tokenRef.current?.cardKey !== cardKey) tokenRef.current = { cardKey, token: tokenizeCard(card).token }
    return tokenRef.current.token
  }

  const place = async (choice: Choice) => {
    if (!pricing) return
    lastChoiceRef.current = choice
    const input: PlaceOrderInput = {
      orderId: cart.orderId,
      shippingAddress: toAddressInput(shipping),
      addressChoice: choice,
      billingSameAsShipping: billingSame,
      billingAddress: billingSame ? undefined : toAddressInput(billing),
      paymentToken: paymentToken(),
      promoCode: promo?.code,
      expectedTotalCents: pricing.totalCents,
    }
    const result = await placeOrder(input)

    if (result.ok) {
      clearDraft()
      history.push(`/checkout/confirmation/${result.order.orderId}`)
      // The placed order is no longer the cart: the next Cart query creates a new one.
      client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'cart' })
      client.cache.gc()
      void client.refetchQueries({ include: ['GetOrders'] })
      return
    }

    const { code, details = {} } = result
    if (code === 'PAYMENT_DECLINED') {
      setDeclined(true)
      setCard((c) => ({ ...c, cvc: '' }))
    } else if (PROMO_CODES.has(code)) {
      setPromoError(code as 'PROMO_INVALID' | 'PROMO_EXPIRED')
      setPromo(undefined)
    } else if (code === 'PRICE_CHANGED') {
      const next = (details.pricing as Pricing | undefined)?.totalCents
      setPriceChanged(next ?? null)
      quote.refetch()
    } else if (code === 'ADDRESS_INVALID') {
      const errs = splitServerErrors(details)
      setServerErrors(errs)
      setAttempted(true)
      setSummaryLinks(
        [
          ...Object.entries(errs.shipping).map(([f, m]) => ({ href: `#shipping-${f}`, message: m! })),
          ...Object.entries(errs.billing).map(([f, m]) => ({ href: `#billing-${f}`, message: m! })),
        ]
      )
    } else if (BLOCKING.has(code)) {
      setBlocked(true)
    } else if (code === 'UNAUTHENTICATED') {
      goToLogin()
    } else if (code === 'PAYMENT_ERROR') {
      setPageError('PAYMENT_ERROR')
    } else {
      // NETWORK, CHECKOUT_IN_PROGRESS after the wait, unexpected errors (S6).
      setPageError('NETWORK')
    }
  }

  const resetAlerts = () => {
    setSummaryLinks(null)
    setPageError(null)
    setPriceChanged(null)
    setDeclined(false)
  }

  const handleSubmit = async () => {
    if (busyRef.current || blocked) return
    busyRef.current = true
    try {
      resetAlerts()
      const links = collectErrors()
      if (links.length > 0) {
        setAttempted(true)
        setSummaryLinks(links)
        return
      }
      if (!pricing) return

      let choice = decision?.key === addressKey ? decision.choice : undefined
      if (!choice) {
        setVerifying(true)
        let verdict: AddressVerdict = 'unavailable'
        let suggested: Address | null = null
        try {
          const res = await client.query({
            query: VALIDATE_ADDRESS,
            variables: { address: toAddressInput(shipping) },
            fetchPolicy: 'network-only',
          })
          verdict = res.data.validateAddress.verdict
          suggested = res.data.validateAddress.suggested
        } catch (e) {
          if (errorCode(e) === 'ADDRESS_INVALID') {
            const errs = splitServerErrors(errorDetails(e))
            setServerErrors(errs)
            setAttempted(true)
            setSummaryLinks(Object.entries(errs.shipping).map(([f, m]) => ({ href: `#shipping-${f}`, message: m! })))
            return
          }
          // A8: verification unavailable never blocks.
        } finally {
          setVerifying(false)
        }
        if (verdict === 'corrected' || verdict === 'undeliverable') {
          setPanel({ verdict, entered: { ...toAddressInput(shipping), country: 'US' } as Address, suggested })
          return
        }
        choice = 'entered'
      }
      await place(choice)
    } finally {
      busyRef.current = false
    }
  }

  const confirmAddress = async (choice: Choice) => {
    setPanel(null)
    setDecision({ key: addressKey, choice })
    if (busyRef.current) return
    busyRef.current = true
    try {
      await place(choice)
    } finally {
      busyRef.current = false
    }
  }

  const retryPlace = async () => {
    setPageError(null)
    if (busyRef.current) return
    busyRef.current = true
    try {
      await place(lastChoiceRef.current)
    } finally {
      busyRef.current = false
    }
  }

  const applyPromo = async (code: string) => {
    setPromoError(undefined)
    try {
      const res = await client.query<{ checkoutQuote: Pricing }>({
        query: CHECKOUT_QUOTE,
        variables: { promoCode: code },
        fetchPolicy: 'network-only',
      })
      setPromo({ code: res.data.checkoutQuote.promoCode ?? code, percent: res.data.checkoutQuote.promoPercent ?? 0 })
    } catch (e) {
      const c = errorCode(e)
      if (c === 'PROMO_INVALID' || c === 'PROMO_EXPIRED') setPromoError(c)
      else setPageError('NETWORK')
    }
  }

  const onShippingChange = (next: AddressForm) => {
    setShipping(next)
    setPanel(null)
    if (Object.keys(serverErrors.shipping).length) setServerErrors((s) => ({ ...s, shipping: {} }))
  }

  const appliedPromo = promo ? { code: promo.code, percent: pricing?.promoPercent ?? promo.percent } : undefined
  const buttonLabel = verifying
    ? 'Checking address...'
    : status !== 'idle'
      ? 'Placing order...'
      : pricing
        ? `Place order · ${formatUsd(pricing.totalCents)}`
        : 'Place order'
  const formDisabled = busy || blocked

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Checkout</h1>

      <div className="space-y-4 mb-6">
        {blocked && (
          <Alert
            variant="error"
            action={
              <Button variant="outline" className="h-9 border-gray-300" onClick={() => history.push('/order')}>
                Back to orders
              </Button>
            }
          >
            {messageFor('CART_EMPTY')}
          </Alert>
        )}
        {pageError && (
          <Alert
            variant="error"
            action={
              <Button variant="outline" className="h-9 border-gray-300" onClick={() => void retryPlace()} disabled={busy}>
                Try again
              </Button>
            }
          >
            {messageFor(pageError)}
          </Alert>
        )}
        {priceChanged !== null && (
          <Alert variant="warning">Your total changed to {formatUsd(priceChanged)}. Review and place order again.</Alert>
        )}
        {summaryLinks && (
          <Alert variant="error" ref={summaryRef} tabIndex={-1} aria-label="Please fix the highlighted fields." title="Please fix the highlighted fields.">
            <ul className="mt-1 list-disc pl-5">
              {summaryLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="underline">
                    {l.message}
                  </a>
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <form
          noValidate
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className={sectionTitle}>Shipping address</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressFields
                idPrefix="shipping"
                value={shipping}
                onChange={onShippingChange}
                errors={shippingErrors}
                disabled={formDisabled}
                autocomplete
              />
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className={sectionTitle}>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentSection
                card={card}
                onCardChange={setCard}
                billingSame={billingSame}
                onBillingSameChange={setBillingSame}
                billing={billing}
                onBillingChange={setBilling}
                cardErrors={cardErrors}
                billingErrors={billingErrors}
                declined={declined}
                disabled={formDisabled}
              />
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className={sectionTitle}>Promo code</CardTitle>
            </CardHeader>
            <CardContent>
              <PromoCodeField
                applied={appliedPromo}
                onApply={applyPromo}
                onRemove={() => setPromo(undefined)}
                error={promoError}
                disabled={formDisabled}
              />
            </CardContent>
          </Card>
          {/* Lets Enter in any field submit the form. */}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>

        <aside className="lg:sticky lg:top-8 self-start">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className={sectionTitle}>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <OrderSummary items={cart.products} pricing={pricing} state={quote.state} onRetry={quote.refetch} />
              {panel && (
                <AddressVerificationPanel
                  verdict={panel.verdict}
                  entered={panel.entered}
                  suggested={panel.suggested}
                  onConfirm={(c) => void confirmAddress(c)}
                  disabled={busy}
                />
              )}
              <Button
                type="button"
                className={`w-full ${primaryButton}`}
                onClick={() => void handleSubmit()}
                disabled={busy || blocked || quote.state === 'loading' || quote.state === 'error'}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {buttonLabel}
              </Button>
              {status === 'retrying' && (
                <p className="text-sm text-gray-600" role="status">
                  Still working... Please don't close this page.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default CheckoutPage

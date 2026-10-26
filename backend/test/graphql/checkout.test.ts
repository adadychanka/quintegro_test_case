import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, gql, login } from '../helpers/app';
import { checkoutInput } from '../helpers/checkout';

const CHECKOUT = `mutation Checkout($input: CheckoutInput!) {
  checkout(input: $input) {
    orderId status addressVerification checkedOutAt
    shippingAddress { fullName line1 city state zip country }
    pricing { subtotalCents discountCents taxCents shippingCents totalCents currency promoCode promoPercent taxStatus }
    paymentMethod { brand last4 }
  }
}`;

describe('checkout over GraphQL', () => {
  it('requires authentication', async () => {
    const { app } = await createTestApp();
    const res = await gql(app, CHECKOUT, { input: checkoutInput() });
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('places the order and the next cart is a new empty one', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(app, CHECKOUT, { input: checkoutInput() }, token);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.checkout).toMatchObject({
      orderId: 'order-2',
      status: 'submited',
      paymentMethod: { brand: 'visa', last4: '4242' },
      pricing: { totalCents: 144785, shippingCents: 0, currency: 'USD' },
    });
    const cart = await gql(app, '{ cart { orderId itemCount } }', {}, token);
    expect(cart.body.data.cart).toEqual({ orderId: 'order-3', itemCount: 0 });
  });

  it('PRICE_CHANGED carries the new pricing', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(app, CHECKOUT, { input: checkoutInput({ expectedTotalCents: 5 }) }, token);
    expect(res.body.errors[0].extensions).toMatchObject({ code: 'PRICE_CHANGED', pricing: { totalCents: 144785 } });
  });

  it('reset clears orders and payments', async () => {
    const { app, container } = await createTestApp();
    const token = await login(app);
    await gql(app, CHECKOUT, { input: checkoutInput() }, token);
    await request(app).get('/reset/orders');
    expect(container.repositories.payments.findByOrderId('order-2')).toHaveLength(0);
    expect(container.repositories.orders.findById('order-2')!.status).toBe('created');
    const again = await gql(app, CHECKOUT, { input: checkoutInput() }, token);
    expect(again.body.data.checkout.status).toBe('submited');
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, gql, login } from '../helpers/app';

describe('cart over GraphQL and REST', () => {
  it('cart query requires authentication', async () => {
    const { app } = await createTestApp();
    const res = await gql(app, '{ cart { orderId } }');
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('cart query returns the cart with totals', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(app, '{ cart { orderId status itemCount subtotalCents createAt } }', {}, token);
    expect(res.body.data.cart).toMatchObject({ orderId: 'order-2', status: 'created', itemCount: 2, subtotalCents: 149998 });
  });

  it('updateItemAmount persists the amount', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(
      app,
      'mutation { updateItemAmount(orderId: "order-2", productId: "product-2", amount: 3) { itemCount products { amount product { id } } } }',
      {},
      token
    );
    expect(res.body.data.updateItemAmount.itemCount).toBe(4);
  });

  it('orderSum ignores client price', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(
      app,
      'query { orderSum(orderId: "order-2", products: [{ id: "product-2", amount: 10, price: 0.01 }]) }',
      {},
      token
    );
    expect(res.body.data.orderSum).toBe(1499.98);
  });

  it('submitOrder returns USE_CHECKOUT', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(app, 'mutation { submitOrder(orderId: "order-2") }', {}, token);
    expect(res.body.errors[0].extensions.code).toBe('USE_CHECKOUT');
  });

  it('REST submit returns 409 USE_CHECKOUT', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await request(app).post('/api/order/order-2').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'USE_CHECKOUT' });
  });

  it('REST sum ignores client prices', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await request(app)
      .post('/api/order/order-2/sum')
      .set('Authorization', `Bearer ${token}`)
      .send({ products: [{ id: 'product-2', amount: 10, price: 0.01 }] });
    expect(res.status).toBe(200);
    expect(res.body).toBe(1499.98);
  });

  it('REST delete on a finished order returns 409', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await request(app).delete('/api/order/order-1/product-1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'ORDER_NOT_EDITABLE' });
  });
});

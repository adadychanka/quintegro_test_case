import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, gql, login } from './helpers/app';

describe('app wiring', () => {
  it('REST and GraphQL share data', async () => {
    const { app } = await createTestApp();
    const token = await login(app);

    const del = await gql(
      app,
      'mutation { deleteProductFromOrder(orderId: "order-2", productId: "product-4") { orderId } }',
      {},
      token
    );
    expect(del.body.errors).toBeUndefined();

    const rest = await request(app).get('/api/order/order-2').set('Authorization', `Bearer ${token}`);
    expect(rest.status).toBe(200);
    expect(rest.body.products).toHaveLength(1);
  });

  it('error code reaches client', async () => {
    const { app } = await createTestApp();
    const res = await gql(app, 'query { order(orderId: "x") { orderId } }');
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    expect(res.body.errors[0].message).toBe('Authentication required');
  });

  it('AddressSuggestions bypasses faults', async () => {
    const { app } = await createTestApp({ FAULT_INJECTION: 'on' });
    for (let i = 0; i < 10; i++) {
      const started = Date.now();
      const res = await gql(app, 'query AddressSuggestions { __typename }', {}, undefined, 'AddressSuggestions');
      expect(res.status).not.toBe(500);
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });

  it('health bypasses faults', async () => {
    const { app } = await createTestApp({ FAULT_INJECTION: 'on' });
    for (let i = 0; i < 6; i++) {
      const started = Date.now();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });

  it('FAULT_INJECTION=off disables delay and errors', async () => {
    const { app } = await createTestApp({ FAULT_INJECTION: 'off' });
    const token = await login(app);
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/api/order').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  it('FAULT_INJECTION=on still delays and injects errors elsewhere', async () => {
    const { app } = await createTestApp({ FAULT_INJECTION: 'on' });
    const statuses: number[] = [];
    const started = Date.now();
    const results = await Promise.all(Array.from({ length: 5 }, () => request(app).get('/')));
    results.forEach((r) => statuses.push(r.status));
    expect(Date.now() - started).toBeGreaterThanOrEqual(1400);
    expect(statuses).toContain(500);
  });
});

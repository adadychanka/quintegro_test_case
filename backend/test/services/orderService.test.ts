import { describe, expect, it } from 'vitest';
import { OrderService } from '../../src/services/orderService';
import {
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository,
} from '../../src/repositories/implementations';

function setup(isLocked: (orderId: string) => boolean = () => false) {
  const orders = new InMemoryOrderRepository();
  const service = new OrderService(orders, new InMemoryProductRepository(), new InMemoryPromoRepository(), isLocked);
  return { orders, service };
}

async function codeOf(p: Promise<unknown> | (() => unknown)): Promise<string | undefined> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (e: any) {
    return e.code;
  }
  return undefined;
}

describe('OrderService cart', () => {
  it('getOrCreateCart returns existing created order', () => {
    const { service } = setup();
    const cart = service.getOrCreateCart('user-1');
    expect(cart.orderId).toBe('order-2');
    expect(cart.status).toBe('created');
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotalCents).toBe(149998);
  });

  it('getOrCreateCart creates one empty cart', () => {
    const { service, orders } = setup();
    const cart = service.getOrCreateCart('user-2');
    expect(cart).toMatchObject({ orderId: 'order-3', status: 'created', products: [], itemCount: 0, subtotalCents: 0 });
    expect(service.getOrCreateCart('user-2').orderId).toBe('order-3');
    expect(orders.findByUserId('user-2')).toHaveLength(1);
  });

  it('stores prices in cents and exposes dollars in the DTO', () => {
    const { service, orders } = setup();
    expect(orders.findById('order-2')!.products[0].priceCents).toBe(89999);
    expect(service.getOrCreateCart('user-1').products[0].price).toBe(899.99);
  });

  it('deleting last item leaves empty cart', async () => {
    const { service } = setup();
    await service.deleteProductFromOrder('order-2', 'product-2', 'user-1');
    const order = await service.deleteProductFromOrder('order-2', 'product-4', 'user-1');
    expect(order).toMatchObject({ orderId: 'order-2', status: 'created', products: [] });
  });

  it('submitted order is read-only', async () => {
    const { service } = setup();
    expect(await codeOf(service.updateItemAmount('order-1', 'product-1', 2, 'user-1'))).toBe('ORDER_NOT_EDITABLE');
    expect(await codeOf(service.deleteProductFromOrder('order-1', 'product-1', 'user-1'))).toBe('ORDER_NOT_EDITABLE');
  });

  it('other users cannot edit the order', async () => {
    const { service } = setup();
    expect(await codeOf(service.updateItemAmount('order-2', 'product-2', 2, 'user-2'))).toBe('ORDER_NOT_FOUND');
    expect(await codeOf(service.deleteProductFromOrder('order-2', 'product-2', 'user-2'))).toBe('ORDER_NOT_FOUND');
  });

  it('updateItemAmount rejects 0, 11 and fractions', async () => {
    const { service } = setup();
    for (const amount of [0, 11, 2.5]) {
      expect(await codeOf(service.updateItemAmount('order-2', 'product-2', amount, 'user-1'))).toBe('VALIDATION_ERROR');
    }
  });

  it('updateItemAmount persists only the target order', async () => {
    const { service } = setup();
    const updated = await service.updateItemAmount('order-2', 'product-2', 3, 'user-1');
    expect(updated.products.find((p) => p.product.id === 'product-2')!.amount).toBe(3);
    expect((await service.getOrderById('order-2', 'user-1'))!.products[0].amount).toBe(3);
    expect((await service.getOrderById('order-1', 'user-1'))!.products[0].amount).toBe(1);
  });

  it('cart edits are rejected while checkout runs', async () => {
    const { service } = setup((id) => id === 'order-2');
    expect(await codeOf(service.updateItemAmount('order-2', 'product-2', 2, 'user-1'))).toBe('CHECKOUT_IN_PROGRESS');
    expect(await codeOf(service.deleteProductFromOrder('order-2', 'product-2', 'user-1'))).toBe('CHECKOUT_IN_PROGRESS');
  });

  it('calculateOrderSum uses stored lines, not client prices', () => {
    const { service } = setup();
    expect(service.calculateOrderSum('order-2', 'user-1')).toBe(1499.98);
    expect(service.calculateOrderSum('order-2', 'user-1', 'SAVE10')).toBe(1349.98);
  });

  it('reset removes lazily created carts', () => {
    const { service, orders } = setup();
    service.getOrCreateCart('user-2');
    orders.reset();
    expect(orders.findByUserId('user-2')).toHaveLength(0);
  });
});

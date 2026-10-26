import { Container } from '../container';
import { AppError } from '../domain/errors';
import { requireUser, resolver } from './errors';

export const createResolvers = (container: Container) => {
  const { orders: orderService, auth: authService, promos: promoService } = container.services;

  return {
    Query: {
      orders: resolver(async (_args: {}, ctx) => {
        const userId = requireUser(ctx);
        return orderService.getOrdersByUserId(userId);
      }),

      order: resolver(async ({ orderId }: { orderId: string }, ctx) => {
        const userId = requireUser(ctx);
        const order = await orderService.getOrderById(orderId, userId);
        if (!order) {
          throw new AppError('ORDER_NOT_FOUND', 'Order not found');
        }
        return order;
      }),

      cart: resolver(async (_args: {}, ctx) => {
        const userId = requireUser(ctx);
        return orderService.getOrCreateCart(userId);
      }),

      orderSum: resolver(async ({ orderId, promo }: { orderId: string; promo?: string }, ctx) => {
        const userId = requireUser(ctx);
        return orderService.calculateOrderSum(orderId, userId, promo);
      }),

      promo: resolver(async ({ promoId }: { promoId: string }) => {
        const validation = promoService.validatePromo(promoId);
        if (!validation.isValid) {
          if (validation.error === 'Promo expired') {
            throw new AppError('PROMO_EXPIRED', 'This promo code has expired.');
          }
          throw new AppError('PROMO_INVALID', "This promo code doesn't exist.");
        }
        return validation.promo;
      }),
    },

    Mutation: {
      login: resolver(async ({ input }: { input: { login: string; password: string } }) => {
        const token = await authService.authenticateUser(input.login, input.password);
        if (!token) {
          throw new AppError('UNAUTHENTICATED', 'Invalid credentials');
        }
        return { token };
      }),

      submitOrder: resolver(async (_args: { orderId: string }, ctx) => {
        requireUser(ctx);
        throw new AppError('USE_CHECKOUT', 'Use checkout to place an order.');
      }),

      deleteProductFromOrder: resolver(async ({ orderId, productId }: { orderId: string; productId: string }, ctx) => {
        const userId = requireUser(ctx);
        return orderService.deleteProductFromOrder(orderId, productId, userId);
      }),

      updateItemAmount: resolver(
        async ({ orderId, productId, amount }: { orderId: string; productId: string; amount: number }, ctx) => {
          const userId = requireUser(ctx);
          return orderService.updateItemAmount(orderId, productId, amount, userId);
        }
      ),
    },
  };
};

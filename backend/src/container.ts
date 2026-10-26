import { AuthService } from './services/authService';
import { OrderService } from './services/orderService';
import { PromoService } from './services/promoService';
import {
  InMemoryAuthRepository,
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository,
  InMemoryUserRepository,
  InMemoryPaymentRepository,
} from './repositories/implementations';
import { CheckoutService } from './services/checkoutService';
import { IdempotencyStore } from './services/checkout/IdempotencyStore';
import { OrderLockRegistry } from './services/checkout/OrderLockRegistry';
import { createProviders } from './providers';
import { PricingService } from './services/pricingService';
import { AddressService } from './services/addressService';
import { FixedWindowRateLimiter } from './services/rateLimiter';

export type Env = Record<string, string | undefined>;

export interface ContainerConfig {
  faultInjection: boolean;
}

// One instance of every repository and service, shared by REST and GraphQL.
export function createContainer(env: Env = process.env) {
  const repositories = {
    users: new InMemoryUserRepository(),
    auth: new InMemoryAuthRepository(),
    orders: new InMemoryOrderRepository(),
    products: new InMemoryProductRepository(),
    promos: new InMemoryPromoRepository(),
    payments: new InMemoryPaymentRepository(),
  };

  const providers = createProviders(env);

  const services = {
    auth: new AuthService(repositories.auth, repositories.users),
    orders: new OrderService(repositories.orders, repositories.products, repositories.promos),
    promos: new PromoService(repositories.promos),
    pricing: new PricingService(repositories.promos, providers.tax),
    // Autocomplete hits a paid API: 30 requests per minute per user.
    address: new AddressService(providers.address, new FixedWindowRateLimiter(30, 60_000)),
    locks: new OrderLockRegistry(),
    idempotency: new IdempotencyStore(),
  };
  // Cart edits are rejected while a checkout runs for the order.
  services.orders.setLockChecker((orderId) => services.locks.isLocked(orderId));

  const checkout = new CheckoutService({
    orders: repositories.orders,
    payments: repositories.payments,
    promos: repositories.promos,
    orderService: services.orders,
    pricing: services.pricing,
    address: services.address,
    paymentProvider: providers.payment,
    idempotency: services.idempotency,
    locks: services.locks,
  });

  // Restores seed orders and forgets all checkout state (`/reset/orders`).
  const reset = () => {
    repositories.orders.reset();
    repositories.payments.reset();
    services.idempotency.clear();
    services.locks.clear();
    const payment = providers.payment as { reset?: () => void };
    payment.reset?.();
  };

  const config: ContainerConfig = {
    faultInjection: (env.FAULT_INJECTION ?? 'on') !== 'off',
  };

  return { repositories, services: { ...services, checkout }, providers, config, reset };
}

export type Container = ReturnType<typeof createContainer>;

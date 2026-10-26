import { AuthService } from './services/authService';
import { OrderService } from './services/orderService';
import { PromoService } from './services/promoService';
import {
  InMemoryAuthRepository,
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository,
  InMemoryUserRepository,
} from './repositories/implementations';
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
  };

  const providers = createProviders(env);

  const services = {
    auth: new AuthService(repositories.auth, repositories.users),
    orders: new OrderService(repositories.orders, repositories.products, repositories.promos),
    promos: new PromoService(repositories.promos),
    pricing: new PricingService(repositories.promos, providers.tax),
    // Autocomplete hits a paid API: 30 requests per minute per user.
    address: new AddressService(providers.address, new FixedWindowRateLimiter(30, 60_000)),
  };

  const config: ContainerConfig = {
    faultInjection: (env.FAULT_INJECTION ?? 'on') !== 'off',
  };

  return { repositories, services, providers, config };
}

export type Container = ReturnType<typeof createContainer>;

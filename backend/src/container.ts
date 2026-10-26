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

  const services = {
    auth: new AuthService(repositories.auth, repositories.users),
    orders: new OrderService(repositories.orders, repositories.products, repositories.promos),
    promos: new PromoService(repositories.promos),
  };

  const config: ContainerConfig = {
    faultInjection: (env.FAULT_INJECTION ?? 'on') !== 'off',
  };

  return { repositories, services, config };
}

export type Container = ReturnType<typeof createContainer>;

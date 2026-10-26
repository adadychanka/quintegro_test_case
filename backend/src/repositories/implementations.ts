import { UserRecord, AuthRecord, OrderRecord, ProductRecord, PromoEntity } from '../types/entities';
import { IUserRepository, IAuthRepository, IOrderRepository, IProductRepository, IPromoRepository } from './interfaces';

export class InMemoryUserRepository implements IUserRepository {
  private users: UserRecord[] = [
    {
      id: "user-1",
      name: "John Doe"
    },
    {
      id: "user-2", 
      name: "Jane Smith"
    }
  ];

  findById(id: string): UserRecord | undefined {
    return this.users.find(user => user.id === id);
  }

  findAll(): UserRecord[] {
    return [...this.users];
  }
}

export class InMemoryAuthRepository implements IAuthRepository {
  private authRecords: AuthRecord[] = [
    {
      userId: "user-1",
      login: "john.doe",
      password: "password123"
    },
    {
      userId: "user-2",
      login: "jane.smith", 
      password: "password456"
    }
  ];

  findByLogin(login: string): AuthRecord | undefined {
    return this.authRecords.find(auth => auth.login === login);
  }

  findByLoginAndPassword(login: string, password: string): AuthRecord | undefined {
    return this.authRecords.find(auth => 
      auth.login === login && auth.password === password
    );
  }

  findAll(): AuthRecord[] {
    return [...this.authRecords];
  }
}

export class InMemoryProductRepository implements IProductRepository {
  private products: ProductRecord[] = [
    {
      id: "product-1",
      title: "Laptop",
      description: "High-performance laptop with latest specifications and great battery life. Perfect for work and gaming.",
      image: "/productImg/laptop.svg"
    },
    {
      id: "product-2",
      title: "Smartphone",
      description: "Modern smartphone with advanced camera system and long-lasting battery. Features the latest mobile technology.",
      image: "/productImg/smartphone.svg"
    },
    {
      id: "product-3",
      title: "Headphones",
      description: "Wireless noise-canceling headphones with premium sound quality and comfortable design for extended use.",
      image: "/productImg/headphones.svg"
    },
    {
      id: "product-4",
      title: "Tablet",
      description: "Lightweight tablet perfect for entertainment and productivity. Features a high-resolution display and fast processor.",
      image: "/productImg/tablet.svg"
    }
  ];

  findById(id: string): ProductRecord | undefined {
    return this.products.find(product => product.id === id);
  }

  findAll(): ProductRecord[] {
    return [...this.products];
  }
}

function seedOrders(): OrderRecord[] {
  return [
    {
      orderId: "order-1",
      userId: "user-1",
      status: "finished",
      createAt: Date.now() - 86400000, // 1 day ago
      products: [
        { id: "product-1", amount: 1, priceCents: 129999 },
        { id: "product-3", amount: 2, priceCents: 19999 }
      ]
    },
    {
      orderId: "order-2",
      userId: "user-1",
      status: "created",
      createAt: Date.now(),
      products: [
        { id: "product-2", amount: 1, priceCents: 89999 },
        { id: "product-4", amount: 1, priceCents: 59999 }
      ]
    }
  ];
}

export class InMemoryOrderRepository implements IOrderRepository {
  private orders: OrderRecord[] = seedOrders();

  reset(): void {
    this.orders = seedOrders();
  }

  findById(orderId: string): OrderRecord | undefined {
    return this.orders.find(order => order.orderId === orderId);
  }

  findByUserId(userId: string): OrderRecord[] {
    return this.orders.filter(order => order.userId === userId);
  }

  findCartByUserId(userId: string): OrderRecord | undefined {
    return this.orders.find(order => order.userId === userId && order.status === 'created');
  }

  findAll(): OrderRecord[] {
    return [...this.orders];
  }

  create(order: OrderRecord): void {
    this.orders.push(order);
  }

  // Next id in the existing `order-N` format.
  nextOrderId(): string {
    const max = this.orders.reduce((acc, o) => {
      const n = Number(/^order-(\d+)$/.exec(o.orderId)?.[1] ?? 0);
      return Math.max(acc, n);
    }, 0);
    return `order-${max + 1}`;
  }

  update(order: OrderRecord): void {
    const index = this.orders.findIndex(o => o.orderId === order.orderId);
    if (index !== -1) {
      this.orders[index] = order;
    }
  }
}

export class InMemoryPromoRepository implements IPromoRepository {
  private promos: PromoEntity[] = [
    {
      id: "SAVE10",
      discount: 10,
      dueDate: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    {
      id: "SAVE20",
      discount: 20,
      dueDate: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
    },
    {
      id: "SAVE5",
      discount: 5,
      dueDate: Date.now() - (24 * 60 * 60 * 1000) // 1 day ago (expired)
    }
  ];

  findById(id: string): PromoEntity | undefined {
    return this.promos.find(promo => promo.id === id);
  }

  findAll(): PromoEntity[] {
    return [...this.promos];
  }
}

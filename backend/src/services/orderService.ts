import { OrderRecord, OrderDTO, ProductRecord } from '../types/entities';
import { IOrderRepository, IProductRepository, IPromoRepository } from '../repositories/interfaces';
import { AppError } from '../domain/errors';
import { percentOfCents } from '../domain/money';

export type LockChecker = (orderId: string) => boolean;

export class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository,
    private promoRepository: IPromoRepository,
    private isLocked: LockChecker = () => false
  ) {}

  setLockChecker(isLocked: LockChecker): void {
    this.isLocked = isLocked;
  }

  async getOrdersByUserId(userId: string): Promise<OrderDTO[]> {
    const orders = this.orderRepository.findByUserId(userId);
    return orders.map(order => this.transformToDTO(order));
  }

  async getOrderById(orderId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      return null;
    }
    return this.transformToDTO(order);
  }

  // One cart per user (spec D2.1). Find-or-create runs synchronously, so the
  // in-memory store cannot create two carts for one user.
  getOrCreateCart(userId: string): OrderDTO {
    let cart = this.orderRepository.findCartByUserId(userId);
    if (!cart) {
      cart = {
        orderId: this.orderRepository.nextOrderId(),
        userId,
        status: 'created',
        createAt: Date.now(),
        products: [],
      };
      this.orderRepository.create(cart);
    }
    return this.transformToDTO(cart);
  }

  // Deprecated: kept for old clients. Uses stored lines; client prices are ignored.
  calculateOrderSum(orderId: string, userId: string, promoId?: string): number {
    const order = this.getOwnedOrder(orderId, userId);
    const subtotal = this.subtotalCents(order);
    const promo = promoId ? this.promoRepository.findById(promoId.trim().toUpperCase()) : undefined;
    const discount = promo && Date.now() <= promo.dueDate ? percentOfCents(subtotal, promo.discount) : 0;
    return (subtotal - discount) / 100;
  }

  async deleteProductFromOrder(orderId: string, productId: string, userId: string): Promise<OrderDTO> {
    const order = this.getEditableOrder(orderId, userId);
    const updatedOrder: OrderRecord = {
      ...order,
      products: order.products.filter(item => item.id !== productId),
    };
    this.orderRepository.update(updatedOrder);
    return this.transformToDTO(updatedOrder);
  }

  async updateProductAmount(orderId: string, productId: string, newAmount: number, userId: string): Promise<OrderDTO> {
    return this.updateItemAmount(orderId, productId, newAmount, userId);
  }

  async updateItemAmount(orderId: string, productId: string, amount: number, userId: string): Promise<OrderDTO> {
    if (!Number.isInteger(amount) || amount < 1 || amount > 10) {
      throw new AppError('VALIDATION_ERROR', 'Amount must be between 1 and 10.');
    }
    const order = this.getEditableOrder(orderId, userId);
    if (!order.products.some(item => item.id === productId)) {
      throw new AppError('VALIDATION_ERROR', 'Product is not in this order.');
    }
    const updatedOrder: OrderRecord = {
      ...order,
      products: order.products.map(item => (item.id === productId ? { ...item, amount } : item)),
    };
    this.orderRepository.update(updatedOrder);
    return this.transformToDTO(updatedOrder);
  }

  subtotalCents(order: OrderRecord): number {
    return order.products.reduce((total, item) => total + item.amount * item.priceCents, 0);
  }

  getOwnedOrder(orderId: string, userId: string): OrderRecord {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new AppError('ORDER_NOT_FOUND', 'Order not found');
    }
    return order;
  }

  private getEditableOrder(orderId: string, userId: string): OrderRecord {
    const order = this.getOwnedOrder(orderId, userId);
    if (order.status !== 'created') {
      throw new AppError('ORDER_NOT_EDITABLE', 'This order can no longer be changed.');
    }
    if (this.isLocked(orderId)) {
      throw new AppError('CHECKOUT_IN_PROGRESS', 'Checkout in progress. Try again in a moment.');
    }
    return order;
  }

  transformToDTO(order: OrderRecord): OrderDTO {
    const products = order.products.map(item => {
      const product: ProductRecord | undefined = this.productRepository.findById(item.id);
      if (!product) {
        throw new Error(`Product with id ${item.id} not found`);
      }
      return { product, amount: item.amount, price: item.priceCents / 100 };
    });

    const dto: OrderDTO = {
      orderId: order.orderId,
      status: order.status,
      createAt: order.createAt,
      itemCount: order.products.reduce((n, item) => n + item.amount, 0),
      subtotalCents: this.subtotalCents(order),
      products,
    };
    if (order.promo) dto.promo = order.promo;
    if (order.shippingAddress) dto.shippingAddress = order.shippingAddress;
    if (order.billingAddress) dto.billingAddress = order.billingAddress;
    if (order.addressVerification) dto.addressVerification = order.addressVerification;
    if (order.pricing) dto.pricing = order.pricing;
    if (order.paymentMethod) dto.paymentMethod = order.paymentMethod;
    if (order.checkedOutAt) dto.checkedOutAt = order.checkedOutAt;
    return dto;
  }
}

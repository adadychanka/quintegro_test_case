export interface UserRecord {
  id: string;
  name: string;
}

export interface AuthRecord {
  userId: string;
  login: string;
  password: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface ProductRecord {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface OrderRecord {
  orderId: string;
  userId: string;
  status: OrderStatus;
  createAt: number;
  products: OrderLine[];
  promo?: PromoEntity;
}

export interface OrderLine {
  id: string;
  amount: number;
  priceCents: number;
}

export type OrderStatus = 'created' | 'submited' | 'finished';

export interface OrderDTO {
  orderId: string;
  status: OrderStatus;
  createAt: number;
  itemCount: number;
  subtotalCents: number;
  products: Array<{
    product: ProductRecord;
    amount: number;
    // Dollars, kept for API compatibility (spec Q4).
    price: number;
  }>;
  promo?: PromoEntity;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}

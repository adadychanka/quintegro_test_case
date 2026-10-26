import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { AppError, isAppError } from '../domain/errors';

const HTTP_STATUS: Partial<Record<AppError['code'], number>> = {
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_EDITABLE: 409,
  CHECKOUT_IN_PROGRESS: 409,
  USE_CHECKOUT: 409,
  VALIDATION_ERROR: 400,
};

function sendAppError(res: Response, e: AppError) {
  return res.status(HTTP_STATUS[e.code] ?? 400).json({ error: e.code });
}

interface ProductItem {
  id: string;
  amount: number;
  price: number;
}

interface OrderSumRequest {
  products?: ProductItem[]; // ignored: prices come from stored order lines
  promo?: string;
}

export class OrderController {
  constructor(
    private orderService: OrderService,
    private authService: AuthService
  ) {}

  private extractUserIdFromToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = this.authService.verifyToken(token);
    
    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  }

  async getOrders(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const orders = await this.orderService.getOrdersByUserId(userId);
      return res.status(200).json(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const { orderId } = req.params;
      const order = await this.orderService.getOrderById(orderId, userId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found or access denied' });
      }

      return res.status(200).json(order);
    } catch (error) {
      console.error('Get order by id error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Deprecated: client-supplied prices are ignored; the sum uses stored order lines.
  async calculateOrderSum(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);

      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const { orderId } = req.params;
      const { promo } = (req.body ?? {}) as OrderSumRequest;
      const sum = this.orderService.calculateOrderSum(orderId, userId, promo);
      return res.status(200).json(sum);
    } catch (error) {
      if (isAppError(error)) return sendAppError(res, error);
      console.error('Calculate order sum error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteProductFromOrder(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const { orderId, productId } = req.params;

      if (!orderId || !productId) {
        return res.status(400).json({ error: 'Order ID and Product ID are required' });
      }

      const updatedOrder = await this.orderService.deleteProductFromOrder(orderId, productId, userId);
      return res.status(200).json(updatedOrder);
    } catch (error) {
      if (isAppError(error)) return sendAppError(res, error);
      console.error('Delete product from order error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Deprecated: orders are placed through the GraphQL `checkout` mutation.
  async submitOrder(req: Request, res: Response) {
    const userId = this.extractUserIdFromToken(req);
    if (!userId) {
      return res.status(403).json({ error: 'Invalid or missing authentication token' });
    }
    return res.status(409).json({ error: 'USE_CHECKOUT' });
  }
}

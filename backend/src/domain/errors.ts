export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_EDITABLE'
  | 'CART_EMPTY'
  | 'ADDRESS_INVALID'
  | 'PROMO_INVALID'
  | 'PROMO_EXPIRED'
  | 'PRICE_CHANGED'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_ERROR'
  | 'CHECKOUT_IN_PROGRESS'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'USE_CHECKOUT'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

const TTL_MS = 60_000;

// One checkout per order at a time, even with different idempotency keys (two tabs).
// A lock that is never released expires after 60 s.
export class OrderLockRegistry {
  private locks = new Map<string, number>();

  constructor(private now: () => number = Date.now) {}

  tryAcquire(orderId: string): boolean {
    if (this.isLocked(orderId)) return false;
    this.locks.set(orderId, this.now());
    return true;
  }

  release(orderId: string): void {
    this.locks.delete(orderId);
  }

  isLocked(orderId: string): boolean {
    const acquiredAt = this.locks.get(orderId);
    if (acquiredAt === undefined) return false;
    if (this.now() - acquiredAt >= TTL_MS) {
      this.locks.delete(orderId);
      return false;
    }
    return true;
  }

  clear(): void {
    this.locks.clear();
  }
}

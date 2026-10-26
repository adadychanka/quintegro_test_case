import { ErrorCode } from '../../domain/errors';

export type StoredOutcome =
  | { ok: true; orderId: string }
  | { ok: false; code: ErrorCode; message: string; details?: Record<string, unknown> };

export type BeginResult =
  | { state: 'new' }
  | { state: 'in_progress' }
  | { state: 'completed'; outcome: StoredOutcome }
  | { state: 'mismatch' };

interface Entry {
  requestHash: string;
  createdAt: number;
  outcome?: StoredOutcome;
}

const TTL_MS = 24 * 60 * 60 * 1000;

// Remembers checkout attempts per (user, key) for 24 h (spec D3).
export class IdempotencyStore {
  private entries = new Map<string, Entry>();

  constructor(private now: () => number = Date.now) {}

  begin(userId: string, key: string, requestHash: string): BeginResult {
    this.purgeExpired();
    const id = `${userId}:${key}`;
    const entry = this.entries.get(id);
    if (!entry) {
      this.entries.set(id, { requestHash, createdAt: this.now() });
      return { state: 'new' };
    }
    if (entry.requestHash !== requestHash) return { state: 'mismatch' };
    if (!entry.outcome) return { state: 'in_progress' };
    return { state: 'completed', outcome: entry.outcome };
  }

  complete(userId: string, key: string, outcome: StoredOutcome): void {
    const entry = this.entries.get(`${userId}:${key}`);
    if (entry) entry.outcome = outcome;
  }

  // Forget an attempt so the same key can run again (retryable failures).
  abandon(userId: string, key: string): void {
    this.entries.delete(`${userId}:${key}`);
  }

  clear(): void {
    this.entries.clear();
  }

  private purgeExpired(): void {
    const t = this.now();
    for (const [id, entry] of this.entries) {
      if (t - entry.createdAt >= TTL_MS) this.entries.delete(id);
    }
  }
}

import { Address, AddressInput, validateAddressInput } from '../domain/address';
import { AppError } from '../domain/errors';
import { AddressProvider, AddressSuggestion } from '../providers/address/AddressProvider';
import { FixedWindowRateLimiter } from './rateLimiter';
import { withTimeout } from './withTimeout';

export type AddressCheckVerdict = 'verified' | 'corrected' | 'undeliverable' | 'unavailable';

export interface AddressCheck {
  verdict: AddressCheckVerdict;
  suggested?: Address;
}

export const ADDRESS_TIMEOUT_MS = 2000;
const MIN_QUERY = 3;

export class AddressService {
  constructor(
    private provider: AddressProvider,
    private limiter: FixedWindowRateLimiter,
    private timeoutMs: number = ADDRESS_TIMEOUT_MS
  ) {}

  async suggest(userId: string, query: string): Promise<AddressSuggestion[]> {
    if (query.trim().length < MIN_QUERY) return [];
    if (!this.limiter.hit(userId)) {
      throw new AppError('RATE_LIMITED', 'Too many requests. Try again in a minute.');
    }
    return this.provider.suggest(query);
  }

  parse(input: AddressInput, fieldPrefix = ''): Address {
    const result = validateAddressInput(input);
    if (!result.ok) {
      throw new AppError('ADDRESS_INVALID', 'Please fix the highlighted fields.', {
        fieldErrors: result.fieldErrors.map((e) => ({ field: `${fieldPrefix}${e.field}`, message: e.message })),
      });
    }
    return result.address;
  }

  // Never blocks (spec D5.2): provider errors and timeouts become `unavailable`.
  async check(address: Address): Promise<AddressCheck> {
    try {
      return await withTimeout(this.provider.validate(address), this.timeoutMs);
    } catch {
      return { verdict: 'unavailable' };
    }
  }
}

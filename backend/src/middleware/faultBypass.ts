import { Request } from 'express';

// Operations that must stay fast and reliable (spec D5.1): no artificial delay, no injected errors.
const BYPASS_OPERATIONS = new Set(['AddressSuggestions']);

export function shouldBypassFaults(req: Request): boolean {
  const path = req.path;
  if (path === '/health') return true;
  if (path.startsWith('/productImg') || path.startsWith('/api-docs')) return true;
  if (path === '/graphql') {
    const operationName = (req.body as { operationName?: unknown } | undefined)?.operationName;
    return typeof operationName === 'string' && BYPASS_OPERATIONS.has(operationName);
  }
  return false;
}

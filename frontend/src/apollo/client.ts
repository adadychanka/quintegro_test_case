import { ApolloClient, DefaultOptions, InMemoryCache, Operation, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URI || 'http://localhost:3000/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('auth_token');

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, path, extensions }) =>
      console.log(`[GraphQL error]: Code: ${extensions?.code}, Message: ${message}, Path: ${path}`)
    );
  if (networkError) console.log(`[Network error]: ${networkError}`);
});

// Safe to repeat: read queries and the idempotent checkout (spec D3, §9a). Never other mutations.
export const RETRYABLE_OPERATIONS = new Set(['Checkout', 'CheckoutQuote', 'Cart', 'GetOrders', 'GetOrder', 'ValidateAddress', 'GetPromo']);

type RetryListener = (operationName: string) => void;
const retryListeners = new Set<RetryListener>();

// Lets the UI show "Still working..." while a request is being retried.
export const retryEvents = {
  subscribe(listener: RetryListener): () => void {
    retryListeners.add(listener);
    return () => retryListeners.delete(listener);
  },
};

export function retryIf(error: unknown, operation: Operation): boolean {
  if (!error || !RETRYABLE_OPERATIONS.has(operation.operationName)) return false;
  const status = (error as { statusCode?: number }).statusCode;
  // No status code: the request never got a response (network error).
  const retry = status === undefined || status >= 500;
  if (retry) retryListeners.forEach((l) => l(operation.operationName));
  return retry;
}

// 1 attempt + 3 retries, waiting 500 ms, 1000 ms, 2000 ms.
const retryLink = new RetryLink({
  delay: { initial: 500, max: 2000, jitter: false },
  attempts: { max: 4, retryIf },
});

export function createCache() {
  return new InMemoryCache({
    typePolicies: {
      Order: { keyFields: ['orderId'] },
    },
  });
}

export const DEFAULT_OPTIONS: DefaultOptions = {
  watchQuery: {
    errorPolicy: 'all',
  },
  query: {
    errorPolicy: 'all',
  },
};

export const client = new ApolloClient({
  link: from([errorLink, authLink, retryLink, httpLink]),
  cache: createCache(),
  defaultOptions: DEFAULT_OPTIONS,
});

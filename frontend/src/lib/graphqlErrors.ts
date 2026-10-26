import { ApolloError } from '@apollo/client'

// The backend puts a stable code in `extensions.code` (see spec §8).
export function errorCode(error: unknown): string | undefined {
  if (error instanceof ApolloError) {
    const code = error.graphQLErrors[0]?.extensions?.code
    if (typeof code === 'string') return code
    if (error.networkError) return 'NETWORK'
  }
  return undefined
}

export function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof ApolloError) {
    return (error.graphQLErrors[0]?.extensions ?? {}) as Record<string, unknown>
  }
  return {}
}

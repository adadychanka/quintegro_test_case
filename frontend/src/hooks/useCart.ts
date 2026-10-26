import { useQuery } from '@apollo/client'
import { CART } from '@/graphql/cart'
import type { Order } from '@/types/order'

export function isSignedIn(): boolean {
  return !!localStorage.getItem('auth_token')
}

export function useCart() {
  const { data, loading, error, refetch } = useQuery<{ cart: Order }>(CART, {
    skip: !isSignedIn(),
    notifyOnNetworkStatusChange: true,
  })
  return { cart: data?.cart, loading, error, refetch: () => void refetch() }
}

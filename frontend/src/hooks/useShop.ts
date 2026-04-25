'use client';
import { useQuery } from '@tanstack/react-query';
import { getMyShop, type Shop } from '@/lib/shopApi';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export function useShop() {
  const { user } = useAuth();
  const query = useQuery<Shop | null>({
    queryKey: ['my-shop', user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        return await getMyShop();
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === 'not_found') return null;
        throw err;
      }
    },
    staleTime: 30_000,
  });

  return {
    shop: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

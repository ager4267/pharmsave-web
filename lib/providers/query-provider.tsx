'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 데이터가 stale로 간주되는 시간 (5분)
            staleTime: 5 * 60 * 1000,
            // 캐시 유지 시간 (10분)
            gcTime: 10 * 60 * 1000,
            // 자동 리페치 비활성화 (필요시 수동으로)
            refetchOnWindowFocus: false,
            // 재시도 횟수
            retry: 1,
            // 에러 발생 시 재시도 지연 시간
            retryDelay: 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}


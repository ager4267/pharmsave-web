'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SalesList, Profile } from '@/lib/types'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function BuyerSalesRequestPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [salesLists, setSalesLists] = useState<SalesList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
    
    // 페이지 포커스 시 데이터 새로고침
    const handleFocus = () => {
      fetchData()
    }
    
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const fetchData = async () => {
    try {
      // 1. 사용자 인증 확인
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      // 2. 프로필 조회
      try {
        const response = await fetch('/api/admin/get-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.profile) {
            setProfile(result.profile as Profile)
          }
        }
      } catch (apiError) {
        console.error('프로필 조회 오류:', apiError)
      }

      // 3. 판매 요청 리스트 조회 (buyer도 seller_id에 자신의 id를 넣어서 사용)
      const { data, error } = await supabase
        .from('sales_lists')
        .select('*')
        .eq('seller_id', user.id)
        .order('submitted_at', { ascending: false })

      if (error) {
        console.error('판매 요청 조회 오류:', error)
        setError('판매 요청을 불러오는 중 오류가 발생했습니다.')
        return
      }

      // 4. 각 판매요청에 대해 판매완료 여부 및 판매 현황 확인
      const salesListsWithStatus = await Promise.all(
        (data as SalesList[]).map(async (salesList) => {
          // 해당 판매요청의 상품들 조회
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select('status, quantity')
            .eq('sales_list_id', salesList.id)

          let totalProducts = Array.isArray(salesList.items) ? salesList.items.length : 0
          let soldProducts = 0
          let remainingProducts = totalProducts
          let displayStatus = salesList.status

          if (!productsError && products && products.length > 0) {
            totalProducts = products.length
            // 판매된 상품 수 계산 (status='sold'인 상품)
            soldProducts = products.filter((product) => product.status === 'sold').length
            remainingProducts = totalProducts - soldProducts

            // 승인된 판매요청만 판매완료 여부 확인
            if (salesList.status === 'approved') {
              // 모든 상품이 'sold' 상태인지 확인
              const allSold = products.every((product) => product.status === 'sold')
              if (allSold) {
                // 판매완료 상태를 나타내기 위해 status를 'sold'로 표시 (실제 DB는 변경하지 않음)
                displayStatus = 'sold' as any
              }
            }
          }

          return {
            ...salesList,
            displayStatus,
            totalProducts,
            soldProducts,
            remainingProducts,
          }
        })
      )

      setSalesLists(salesListsWithStatus as any[])
    } catch (error) {
      console.error('오류:', error)
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleDelete = async (salesListId: string) => {
    if (!confirm('이 판매 요청을 삭제하시겠습니까?')) {
      return
    }

    try {
      setDeletingId(salesListId)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다.')
        return
      }

      const response = await fetch('/api/seller/delete-sales-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salesListId,
          userId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // 목록 새로고침
        await fetchData()
      } else {
        setError(result.error || '삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('삭제 오류:', error)
      setError('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link
                href="/buyer/products"
                className="text-gray-500 hover:text-gray-700"
              >
                ← 개인 정보
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">판매 요청</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {formatCompanyName(profile?.company_name, '-')} ({profile?.email})
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">내 판매 요청</h2>
          <Link
            href="/buyer/sales-request/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            새 판매 요청 작성
          </Link>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {salesLists.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 판매 요청이 없습니다</h3>
            <p className="text-gray-600 mb-4">불용 재고를 판매 요청하여 시작하세요.</p>
            <Link
              href="/buyer/sales-request/new"
              className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              첫 판매 요청 작성하기
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제출일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품 수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    조회
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salesLists.map((list) => (
                  <tr key={list.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(list.submitted_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {(list as any).totalProducts || (Array.isArray(list.items) ? list.items.length : 0)}개
                        </span>
                        {(list as any).soldProducts > 0 && (
                          <span className="text-xs text-gray-500 mt-1">
                            판매: {(list as any).soldProducts}개, 남은: {(list as any).remainingProducts || 0}개
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        (list as any).displayStatus === 'sold'
                          ? 'bg-blue-100 text-blue-800'
                          : list.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : list.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {(list as any).displayStatus === 'sold' && '판매완료'}
                        {list.status === 'approved' && (list as any).displayStatus !== 'sold' && '승인'}
                        {list.status === 'rejected' && '거부됨'}
                        {list.status === 'pending' && '대기 중'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/buyer/sales-request/${list.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        상세보기
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDelete(list.id)}
                        disabled={deletingId === list.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === list.id ? '삭제 중...' : '삭제'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}



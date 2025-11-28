'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/types'
import SellerNav from '../components/SellerNav'
import { formatCompanyName, formatCompanyNameWithEmail } from '@/lib/utils/format-company-name'

export default function SellerPurchaseRequestsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      console.log('🔍 판매자 구매 요청 페이지 로드 시작...')
      
      // 1. 사용자 인증 확인
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError) {
        console.error('❌ 사용자 조회 오류:', userError)
        setError(`사용자 조회 실패: ${userError.message}`)
        setLoading(false)
        return
      }

      if (!user) {
        console.log('⚠️ 사용자가 없습니다. 로그인 페이지로 이동합니다.')
        router.push('/login')
        return
      }

      console.log('✅ 사용자 확인됨:', user.id, user.email)

      // 2. API를 통해 프로필 조회
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
            const apiProfile = result.profile
            console.log('✅ API를 통해 프로필 조회 성공:', apiProfile)
            
            // 관리자가 아닌 모든 사용자는 판매자이면서 구매자
            if (apiProfile.role === 'admin') {
              console.error('❌ 관리자는 이 페이지에 접근할 수 없습니다.')
              router.push('/admin/dashboard')
              return
            }

            setProfile(apiProfile as Profile)
          }
        }
      } catch (apiError) {
        console.error('❌ API 호출 오류:', apiError)
      }

      // 3. 판매자의 상품에 대한 구매 요청 조회
      // 먼저 판매자의 상품 ID 목록 조회
      const { data: myProducts, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('seller_id', user.id)

      if (productsError) {
        console.error('❌ 상품 조회 오류:', productsError)
        setError('상품 정보를 불러오는 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }

      if (!myProducts || myProducts.length === 0) {
        console.log('⚠️ 판매자의 상품이 없습니다.')
        setPurchaseRequests([])
        setLoading(false)
        return
      }

      const productIds = myProducts.map(p => p.id)
      console.log('📦 판매자의 상품 ID:', productIds.length, '개')

      // 구매 요청 조회
      const { data: requests, error: requestsError } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          profiles:profiles!purchase_requests_buyer_id_fkey(email, company_name),
          products:products!purchase_requests_product_id_fkey(product_name, selling_price)
        `)
        .in('product_id', productIds)
        .order('requested_at', { ascending: false })

      if (requestsError) {
        console.error('❌ 구매 요청 조회 오류:', requestsError)
        setError('구매 요청을 불러오는 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }

      // products가 배열인 경우 첫 번째 요소 사용
      const processedData = (requests || []).map((req: any) => ({
        ...req,
        product_name: Array.isArray(req.products) 
          ? req.products[0]?.product_name 
          : req.products?.product_name || '-',
        selling_price: Array.isArray(req.products) 
          ? req.products[0]?.selling_price 
          : req.products?.selling_price || 0,
      }))

      console.log('✅ 구매 요청 조회 성공:', processedData.length, '개')
      setPurchaseRequests(processedData)
    } catch (error: any) {
      console.error('❌ 오류:', error)
      setError(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">오류 발생</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              로그인 페이지로 이동
            </button>
          </div>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">구매 요청 목록</h1>
              <p className="text-sm text-gray-500 mt-1">
                {formatCompanyName(profile?.company_name, '-')} ({profile?.email})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 네비게이션 바 */}
      <SellerNav />

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {purchaseRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">구매 요청이 없습니다</h3>
            <p className="text-gray-500">
              아직 상품에 대한 구매 요청이 없습니다.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    구매자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    요청일
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchaseRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {request.product_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCompanyNameWithEmail(request.profiles?.company_name, request.profiles?.email)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {request.quantity}개
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Number(request.unit_price).toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {Number(request.total_price).toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : request.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : request.status === 'cancelled'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.status === 'approved'
                          ? '승인됨'
                          : request.status === 'rejected'
                          ? '거부됨'
                          : request.status === 'cancelled'
                          ? '취소됨'
                          : '대기 중'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {request.requested_at
                        ? new Date(request.requested_at).toLocaleDateString('ko-KR')
                        : '-'}
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


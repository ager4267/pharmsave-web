'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyName, formatCompanyNameWithEmail } from '@/lib/utils/format-company-name'

export default function AdminPurchaseRequestsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBuyer, setSelectedBuyer] = useState<Profile | null>(null)
  const [showBuyerModal, setShowBuyerModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('all')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        // 프로필 정보 가져오기
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileData?.role !== 'admin') {
          router.push('/dashboard')
          return
        }

        setProfile(profileData as Profile)
        await fetchPurchaseRequests()
      } catch (error) {
        console.error('오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, supabase, filter])

  const fetchPurchaseRequests = async () => {
    try {
      let query = supabase
        .from('purchase_requests')
        .select(`
          *,
          buyer:profiles!purchase_requests_buyer_id_fkey(id, email, company_name),
          product:products!purchase_requests_product_id_fkey(
            id,
            product_name,
            seller_id,
            seller:profiles!products_seller_id_fkey(id, email, company_name)
          )
        `)
        .order('requested_at', { ascending: false })

      if (filter === 'pending') {
        query = query.eq('status', 'pending')
      } else if (filter === 'approved') {
        query = query.eq('status', 'approved')
      } else if (filter === 'rejected') {
        query = query.eq('status', 'rejected')
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed')
      }

      const { data, error } = await query

      if (error) {
        console.error('구매 요청 조회 오류:', error)
        return
      }

      // 데이터 처리
      const processedData = (data || []).map((req: any) => ({
        ...req,
        product_name: req.product?.product_name || '-',
        seller: req.product?.seller || null,
        buyer: req.buyer || null,
      }))

      setPurchaseRequests(processedData)
    } catch (error) {
      console.error('오류:', error)
    }
  }

  const handleDelete = async (purchaseRequestId: string) => {
    if (!confirm('이 구매 요청을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/admin/delete-purchase-request', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purchaseRequestId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message || '구매 요청이 삭제되었습니다.')
        await fetchPurchaseRequests()
      } else {
        alert(result.error || '구매 요청 삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('구매 요청 삭제 오류:', error)
      alert('구매 요청 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleApprove = async (purchaseRequestId: string, status: 'approved' | 'rejected') => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch('/api/admin/approve-purchase-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purchaseRequestId,
          status,
          adminUserId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message || '구매 요청이 처리되었습니다.')
        await fetchPurchaseRequests()
      } else {
        alert(result.error || '구매 요청 처리에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('구매 요청 처리 오류:', error)
      alert('구매 요청 처리 중 오류가 발생했습니다.')
    }
  }

  const handleViewBuyerInfo = async (buyerId: string) => {
    try {
      const response = await fetch('/api/admin/get-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: buyerId }),
      })

      const result = await response.json()

      if (result.success && result.profile) {
        setSelectedBuyer(result.profile as Profile)
        setShowBuyerModal(true)
      } else {
        alert('구매자 정보를 불러올 수 없습니다.')
      }
    } catch (error: any) {
      console.error('구매자 정보 조회 오류:', error)
      alert('구매자 정보 조회 중 오류가 발생했습니다.')
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
                href="/admin/dashboard"
                className="text-gray-500 hover:text-gray-700"
              >
                ← 대시보드
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">구매 요청 관리</h1>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              대기 중
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              승인됨
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              거부됨
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'completed'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              완료됨
            </button>
          </div>
        </div>

        {/* 구매 요청 목록 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  구매자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  판매자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상품명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  수량
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  판매금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  요청일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {purchaseRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    구매 요청이 없습니다.
                  </td>
                </tr>
              ) : (
                purchaseRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.buyer ? (
                        <span>
                          {formatCompanyNameWithEmail(request.buyer.company_name, request.buyer.email)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.seller ? (
                        <span>
                          {formatCompanyNameWithEmail(request.seller.company_name, request.seller.email)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.product_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {request.quantity || 0}개
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
                      {request.total_price ? Number(request.total_price).toLocaleString() + '원' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {request.requested_at
                        ? new Date(request.requested_at).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : request.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : request.status === 'completed'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.status === 'approved'
                          ? '승인됨'
                          : request.status === 'rejected'
                          ? '거부됨'
                          : request.status === 'completed'
                          ? '완료됨'
                          : '대기 중'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(request.id, 'approved')}
                              className="text-green-600 hover:text-green-900"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleApprove(request.id, 'rejected')}
                              className="text-red-600 hover:text-red-900"
                            >
                              거부
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(request.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 구매자 정보 모달 */}
      {showBuyerModal && selectedBuyer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">구매자 정보</h3>
                <button
                  onClick={() => setShowBuyerModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">이메일</label>
                  <p className="text-gray-900">{selectedBuyer.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">회사명</label>
                  <p className="text-gray-900">{formatCompanyName(selectedBuyer.company_name)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">사업자등록번호</label>
                  <p className="text-gray-900">{selectedBuyer.business_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">전화번호</label>
                  <p className="text-gray-900">{selectedBuyer.phone_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">주소</label>
                  <p className="text-gray-900">{selectedBuyer.address || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">역할</label>
                  <p className="text-gray-900">
                    {selectedBuyer.role === 'admin' ? '관리자' : '판매자/구매자'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">인증 상태</label>
                  <p className={`font-medium ${
                    selectedBuyer.license_verification_status === 'approved'
                      ? 'text-green-600'
                      : selectedBuyer.license_verification_status === 'rejected'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  }`}>
                    {selectedBuyer.license_verification_status === 'approved'
                      ? '승인됨'
                      : selectedBuyer.license_verification_status === 'rejected'
                      ? '거부됨'
                      : '대기 중'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">가입일</label>
                  <p className="text-gray-900">
                    {selectedBuyer.created_at
                      ? new Date(selectedBuyer.created_at).toLocaleDateString('ko-KR')
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowBuyerModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { SalesList } from '@/lib/types'

export default function BuyerSalesRequestDetailPage() {
  const [salesList, setSalesList] = useState<SalesList | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    fetchSalesList()
    
    // 페이지 포커스 시 데이터 새로고침
    const handleFocus = () => {
      fetchSalesList()
    }
    
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [params.id])

  const fetchSalesList = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('sales_lists')
        .select('*')
        .eq('id', params.id)
        .eq('seller_id', user.id)
        .single()

      if (error) {
        console.error('판매 요청 조회 오류:', error)
        router.push('/buyer/sales-request')
        return
      }

      setSalesList(data as SalesList)
    } catch (error) {
      console.error('오류:', error)
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

  if (!salesList) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">판매 요청을 찾을 수 없습니다.</p>
          <Link href="/buyer/sales-request" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const items = Array.isArray(salesList.items) ? salesList.items : []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <Link
                href="/buyer/products"
                className="text-gray-500 hover:text-gray-700"
              >
                ← 개인 정보
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">판매 요청 상세</h1>
            </div>
            <Link
              href="/buyer/sales-request"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              목록으로
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">제출일</label>
                <p className="mt-1 text-gray-900">
                  {new Date(salesList.submitted_at).toLocaleString('ko-KR')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">상태</label>
                <p className="mt-1">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    salesList.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : salesList.status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {salesList.status === 'approved' && '승인'}
                    {salesList.status === 'rejected' && '거부됨'}
                    {salesList.status === 'pending' && '대기 중'}
                  </span>
                </p>
              </div>
              {salesList.reviewed_at && (
                <div>
                  <label className="text-sm font-medium text-gray-500">검토일</label>
                  <p className="mt-1 text-gray-900">
                    {new Date(salesList.reviewed_at).toLocaleString('ko-KR')}
                  </p>
                </div>
              )}
              {salesList.notes && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">비고</label>
                  <p className="mt-1 text-gray-900">{salesList.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">상품 목록 ({items.length}개)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제품명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">규격</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제조사</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">보험가</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">판매가</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">할인율</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.product_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.specification}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.manufacturer}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.insurance_price ? `${item.insurance_price.toLocaleString()}원` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {item.selling_price.toLocaleString()}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.discount_rate !== undefined ? `${item.discount_rate.toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


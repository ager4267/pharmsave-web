'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { SalesList, Product, PurchaseRequest } from '@/lib/types'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function AdminSalesListDetailPage() {
  const [salesList, setSalesList] = useState<SalesList | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [params.id])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 관리자 권한 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      // 판매 리스트 조회
      const { data: salesListData, error: salesListError } = await supabase
        .from('sales_lists')
        .select('*, profiles:profiles!sales_lists_seller_id_fkey(company_name, email, role)')
        .eq('id', params.id)
        .single()

      if (salesListError || !salesListData) {
        console.error('판매 리스트 조회 오류:', salesListError)
        router.push('/admin/sales-lists')
        return
      }

      setSalesList(salesListData as any)

      // 이 판매 리스트에서 생성된 상품들 조회
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('sales_list_id', params.id)
        .order('created_at', { ascending: false })

      if (productsError) {
        console.error('상품 조회 오류:', productsError)
      } else {
        setProducts(productsData || [])
      }

      // 이 판매 리스트의 상품들에 대한 구매 요청 조회
      if (productsData && productsData.length > 0) {
        const productIds = productsData.map(p => p.id)
        const { data: purchaseRequestsData, error: purchaseRequestsError } = await supabase
          .from('purchase_requests')
          .select(`
            *,
            products:products!purchase_requests_product_id_fkey(
              product_name,
              selling_price
            ),
            profiles:profiles!purchase_requests_buyer_id_fkey(
              company_name,
              email
            )
          `)
          .in('product_id', productIds)
          .order('requested_at', { ascending: false })

        if (purchaseRequestsError) {
          console.error('구매 요청 조회 오류:', purchaseRequestsError)
        } else {
          setPurchaseRequests(purchaseRequestsData || [])
        }
      }
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
          <p className="text-gray-600">판매 리스트를 찾을 수 없습니다.</p>
          <Link href="/admin/sales-lists" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const items = Array.isArray(salesList.items) ? salesList.items : []
  const salesListProfile = (salesList as any).profiles

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/sales-lists"
                className="text-gray-500 hover:text-gray-700"
              >
                ← 판매 요청 관리
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">판매 리스트 상세</h1>
            </div>
          </div>

          {/* 판매 리스트 정보 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">제출자</label>
                <p className="mt-1 text-gray-900">
                  {formatCompanyName(salesListProfile?.company_name, '-')}
                </p>
              </div>
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
                    {salesList.status === 'approved' && '승인됨'}
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

          {/* 판매 리스트 상품 목록 */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">판매 요청 상품 목록 ({items.length}개)</h2>
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
                        {item.specification || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.manufacturer || '-'}
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

          {/* 등록된 상품 목록 (승인된 경우) */}
          {salesList.status === 'approved' && products.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">등록된 상품 ({products.length}개)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제품명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">판매가</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">등록일</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.product_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.status === 'sold'
                              ? 'bg-green-100 text-green-800'
                              : product.status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {product.status === 'sold' && '판매 완료'}
                            {product.status === 'active' && '판매 중'}
                            {product.status === 'inactive' && '비활성'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.quantity}개
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {product.selling_price.toLocaleString()}원
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(product.created_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 구매 요청 목록 */}
          {purchaseRequests.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">구매 요청 목록 ({purchaseRequests.length}개)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">구매자</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">단가</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 금액</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청일</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {purchaseRequests.map((request) => (
                      <tr key={request.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCompanyName(request.profiles?.company_name, '-')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.products?.product_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.quantity}개
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.unit_price.toLocaleString()}원
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {request.total_price.toLocaleString()}원
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            request.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : request.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : request.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {request.status === 'approved' && '승인됨'}
                            {request.status === 'rejected' && '거부됨'}
                            {request.status === 'cancelled' && '취소됨'}
                            {request.status === 'pending' && '대기 중'}
                            {request.status === 'confirmed' && '확인됨'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(request.requested_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {purchaseRequests.length === 0 && salesList.status === 'approved' && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">아직 구매 요청이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


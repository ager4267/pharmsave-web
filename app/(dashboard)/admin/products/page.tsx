'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyNameWithEmail } from '@/lib/utils/format-company-name'

export default function AdminProductsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'sold' | 'inactive'>('all')
  const [sellerFilter, setSellerFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
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
        await fetchProducts()
      } catch (error) {
        console.error('오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, supabase])

  const fetchProducts = async () => {
    try {
      // 1. 상품 목록 조회
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*, profiles:profiles!products_seller_id_fkey(email, company_name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (productsError) {
        console.error('상품 조회 오류:', productsError)
        return
      }

      if (!productsData || productsData.length === 0) {
        setProducts([])
        return
      }

      // 2. 각 상품별로 승인된 구매 요청 수량 합산
      const productIds = productsData.map(p => p.id)
      
      const { data: purchaseRequests, error: purchaseRequestsError } = await supabase
        .from('purchase_requests')
        .select('product_id, quantity')
        .in('product_id', productIds)
        .eq('status', 'approved')

      if (purchaseRequestsError) {
        console.error('구매 요청 조회 오류:', purchaseRequestsError)
        // 구매 요청 조회 실패해도 상품은 표시
        setProducts(productsData)
        return
      }

      // 3. 상품별 판매 수량 계산
      const soldQuantityMap = new Map<string, number>()
      if (purchaseRequests) {
        purchaseRequests.forEach((req: any) => {
          const currentSold = soldQuantityMap.get(req.product_id) || 0
          soldQuantityMap.set(req.product_id, currentSold + (req.quantity || 0))
        })
      }

      // 4. 상품 데이터에 판매 수량 정보 추가
      const productsWithSoldQuantity = productsData.map((product: any) => {
        const soldQuantity = soldQuantityMap.get(product.id) || 0
        const remainingQuantity = (product.quantity || 0) - soldQuantity
        
        return {
          ...product,
          sold_quantity: soldQuantity,
          remaining_quantity: remainingQuantity,
        }
      })

      setProducts(productsWithSoldQuantity)
      setFilteredProducts(productsWithSoldQuantity)
    } catch (error) {
      console.error('오류:', error)
    }
  }

  // 필터링 적용
  useEffect(() => {
    let filtered = [...products]

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }

    // 판매자 필터
    if (sellerFilter !== 'all') {
      filtered = filtered.filter(p => p.seller_id === sellerFilter)
    }

    setFilteredProducts(filtered)
    // 필터 변경 시 선택 해제
    setSelectedProducts(new Set())
  }, [products, statusFilter, sellerFilter])

  // 판매자 목록 추출 (필터용)
  const sellers = Array.from(
    new Map(
      products.map(p => [p.seller_id, {
        id: p.seller_id,
        name: formatCompanyNameWithEmail(p.profiles?.company_name, p.profiles?.email, '알 수 없음')
      }])
    ).values()
  )

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)))
    } else {
      setSelectedProducts(new Set())
    }
  }

  // 개별 선택/해제
  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts)
    if (checked) {
      newSelected.add(productId)
    } else {
      newSelected.delete(productId)
    }
    setSelectedProducts(newSelected)
  }

  // 일괄 삭제
  const handleBatchDelete = async () => {
    if (selectedProducts.size === 0) {
      alert('삭제할 상품을 선택해주세요.')
      return
    }

    const productNames = filteredProducts
      .filter(p => selectedProducts.has(p.id))
      .map(p => p.product_name)
      .slice(0, 3)
      .join(', ')

    const confirmMessage = selectedProducts.size > 3
      ? `정말로 선택한 ${selectedProducts.size}개의 상품을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
      : `정말로 다음 상품들을 삭제하시겠습니까?\n\n${productNames}${selectedProducts.size > 3 ? ' 외 ' + (selectedProducts.size - 3) + '개' : ''}\n\n이 작업은 되돌릴 수 없습니다.`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch('/api/admin/delete-products-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          adminUserId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message || '상품이 삭제되었습니다.')
        setSelectedProducts(new Set())
        await fetchProducts()
      } else {
        alert(result.error || '상품 삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('상품 일괄 삭제 오류:', error)
      alert('상품 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`정말로 상품 "${productName}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch('/api/admin/delete-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          adminUserId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message || '상품이 삭제되었습니다.')
        await fetchProducts()
      } else {
        alert(result.error || '상품 삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('상품 삭제 오류:', error)
      alert('상품 삭제 중 오류가 발생했습니다.')
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
              <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
            </div>
            <div className="text-sm text-gray-500">
              전체 상품: {products.length}개
              {filteredProducts.length !== products.length && ` (필터: ${filteredProducts.length}개)`}
            </div>
          </div>
        </div>
      </div>

      {/* 필터 및 일괄 작업 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* 상태 필터 */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">상태:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체</option>
                <option value="active">판매중</option>
                <option value="sold">판매완료</option>
                <option value="inactive">대기중</option>
              </select>
            </div>

            {/* 판매자 필터 */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">판매자:</label>
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체</option>
                {sellers.map(seller => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 일괄 삭제 버튼 */}
            {selectedProducts.size > 0 && (
              <div className="ml-auto">
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  선택한 {selectedProducts.size}개 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              {products.length === 0 ? '등록된 상품이 없습니다.' : '필터 조건에 맞는 상품이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    규격
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    판매가
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    판매자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    등록일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={selectedProducts.has(product.id) ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.product_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.specification || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.quantity ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            전체: {product.quantity}개
                          </span>
                          {product.sold_quantity > 0 ? (
                            <>
                              <span className="text-blue-600 text-xs mt-1">
                                판매: {product.sold_quantity}개
                              </span>
                              <span className="text-gray-500 text-xs">
                                남음: {product.remaining_quantity}개
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs mt-1">
                              판매: 0개
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.selling_price ? `${Number(product.selling_price).toLocaleString()}원` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCompanyNameWithEmail(product.profiles?.company_name, product.profiles?.email)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        product.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : product.status === 'sold'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {product.status === 'active' ? '판매중' : product.status === 'sold' ? '판매완료' : '대기중'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.created_at
                        ? new Date(product.created_at).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDeleteProduct(product.id, product.product_name)}
                        className="text-red-600 hover:text-red-900 font-medium"
                        title="상품 삭제"
                      >
                        삭제
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


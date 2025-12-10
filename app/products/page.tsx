'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Product, Profile } from '@/lib/types'
import { formatCompanyNameWithEmail } from '@/lib/utils/format-company-name'

export default function ProductsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [purchaseRequests, setPurchaseRequests] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'date' | 'quantity'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const router = useRouter()
  const supabase = createClient()

  // 관리자 여부 확인
  const isAdmin = profile?.role === 'admin'

  // 검색 및 필터링 함수
  useEffect(() => {
    let filtered = [...products]

    // 검색어 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((product: any) => {
        const productName = (product.product_name || '').toLowerCase()
        const manufacturer = (product.manufacturer || '').toLowerCase()
        const specification = (product.specification || '').toLowerCase()
        
        return (
          productName.includes(query) ||
          manufacturer.includes(query) ||
          specification.includes(query)
        )
      })
    }

    // 정렬
    filtered.sort((a: any, b: any) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = (a.product_name || '').localeCompare(b.product_name || '')
          break
        case 'price':
          comparison = Number(a.selling_price || 0) - Number(b.selling_price || 0)
          break
        case 'quantity':
          comparison = (a.quantity || 0) - (b.quantity || 0)
          break
        case 'date':
        default:
          comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredProducts(filtered)
  }, [products, searchQuery, sortBy, sortOrder])

  // 구매 요청 상태 조회 함수
  const fetchPurchaseRequests = async (userId: string, productIds: string[]) => {
    try {
      if (productIds.length === 0) return
      
      const { data, error } = await supabase
        .from('purchase_requests')
        .select('id, product_id, status')
        .eq('buyer_id', userId)
        .in('product_id', productIds)
        .in('status', ['pending', 'confirmed'])

      if (error) {
        console.error('구매 요청 조회 오류:', error)
        return
      }

      if (data) {
        const requestsMap = new Map()
        data.forEach((req: any) => {
          requestsMap.set(req.product_id, req)
        })
        setPurchaseRequests(requestsMap)
      }
    } catch (error) {
      console.error('구매 요청 조회 오류:', error)
    }
  }

  // 구매 요청 취소 함수
  const handleCancelPurchaseRequest = async (purchaseRequestId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch('/api/purchase-requests/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purchaseRequestId,
          userId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // 구매 요청 상태 새로고침
        const productIds = products.map(p => p.id)
        await fetchPurchaseRequests(user.id, productIds)
      } else {
        alert(result.error || '구매 요청 취소에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('구매 요청 취소 오류:', error)
      alert('구매 요청 취소 중 오류가 발생했습니다.')
    }
  }

  // 관리자 상품 삭제 함수
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!isAdmin) {
      alert('관리자 권한이 필요합니다.')
      return
    }

    if (!confirm(`"${productName}" 상품을 삭제하시겠습니까?`)) {
      return
    }

    try {
      setDeletingProductId(productId)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('로그인이 필요합니다.')
        return
      }

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
        // 목록 새로고침
        await fetchData()
      } else {
        alert(result.error || '상품 삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('상품 삭제 오류:', error)
      alert('상품 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingProductId(null)
    }
  }

  // products 상태 변경 추적
  useEffect(() => {
    console.log('📦 products 상태 변경:', {
      length: products.length,
      isArray: Array.isArray(products),
      firstProduct: products[0] ? { id: products[0].id, name: products[0].product_name } : null,
    })
  }, [products])

  const fetchData = async () => {
      try {
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

        // 3. 승인된 상품 목록 조회 (API를 통해 RLS 우회)
        console.log('🔍 상품 조회 시작...')
        
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃
          
          const response = await fetch('/api/products/list', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            },
            cache: 'no-store',
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ API 응답 오류:', {
              status: response.status,
              statusText: response.statusText,
              body: errorText,
            })
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const result = await response.json()
          
          console.log('📥 API 응답 전체:', JSON.stringify(result, null, 2))
          
          if (!result.success) {
            console.error('❌ API 결과 실패:', result)
            // API 실패 시에도 빈 배열로 설정하여 "상품 없음" 메시지 표시
            setProducts([])
            setError(null) // 에러를 표시하지 않고 빈 목록으로 처리
            return
          }

          console.log('✅ API 결과 성공:', {
            success: result.success,
            count: result.count || 0,
            stats: result.stats,
            productsType: Array.isArray(result.products) ? 'array' : typeof result.products,
            productsLength: Array.isArray(result.products) ? result.products.length : 'N/A',
            products: result.products?.map((p: any) => ({ id: p.id, name: p.product_name, status: p.status }))
          })
          
          // products가 배열인지 확인
          if (Array.isArray(result.products)) {
            if (result.products.length > 0) {
              console.log('📦 상품 데이터 샘플:', result.products[0])
              console.log('📦 상품 데이터 전체 개수:', result.products.length)
              
              // 본인이 올린 판매 요청 품목 필터링 (seller_id가 현재 사용자 ID와 일치하는 상품 제외)
              const filteredProducts = result.products.filter((p: Product) => p.seller_id !== user.id)
              console.log(`🔍 필터링 결과: 전체 ${result.products.length}개 중 ${filteredProducts.length}개 표시 (본인 판매 상품 ${result.products.length - filteredProducts.length}개 제외)`)
              
              setProducts(filteredProducts as Product[])
              
              // 구매 요청 상태 조회
              const productIds = filteredProducts.map((p: Product) => p.id)
              await fetchPurchaseRequests(user.id, productIds)
            } else {
              console.warn('⚠️ 조회된 상품이 없습니다 (빈 배열). 통계:', result.stats)
              setProducts([])
              // 빈 배열이어도 에러가 아니므로 에러 상태 초기화
              setError(null)
            }
          } else {
            console.error('❌ products가 배열이 아닙니다:', typeof result.products, result.products)
            setProducts([])
            setError(null)
          }
        } catch (apiError: any) {
          console.error('❌ API 상품 조회 오류:', apiError)
          
          // API 실패 시 직접 조회 시도 (fallback)
          console.log('🔄 직접 조회로 전환 시도...')
          try {
            const { data: productsData, error: productsError } = await supabase
              .from('products')
              .select(`
                *,
                profiles:profiles!products_seller_id_fkey(
                  company_name,
                  email
                )
              `)
              .eq('status', 'active')
              .order('created_at', { ascending: false })

            if (productsError) {
              console.error('❌ 직접 상품 조회 오류:', productsError)
              setError(`상품 조회 실패: ${productsError.message || apiError.message}`)
              setLoading(false)
              return
            }

            console.log('✅ 직접 상품 조회 성공:', productsData?.length || 0, '개')
            
            // 본인이 올린 판매 요청 품목 필터링 (seller_id가 현재 사용자 ID와 일치하는 상품 제외)
            const filteredProducts = (productsData || []).filter((p: Product) => p.seller_id !== user.id)
            console.log(`🔍 필터링 결과: 전체 ${productsData?.length || 0}개 중 ${filteredProducts.length}개 표시 (본인 판매 상품 ${(productsData?.length || 0) - filteredProducts.length}개 제외)`)
            
            setProducts(filteredProducts as Product[])
          } catch (directError: any) {
            console.error('❌ 직접 조회도 실패:', directError)
            setError(`상품 조회 실패: ${apiError.message || directError.message || '알 수 없는 오류'}`)
            setLoading(false)
            return
          }
        }
      } catch (error: any) {
        console.error('❌ 오류:', error)
        setError(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`)
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    // 초기 로드 시 products 상태 초기화
    setProducts([])
    setError(null)
    
    // 즉시 데이터 로드 시작
    fetchData()
    
    // 페이지 포커스 시 데이터 새로고침 (5초 이상 경과한 경우만)
    let lastFetchTime = Date.now()
    const handleFocus = () => {
      const now = Date.now()
      if (now - lastFetchTime > 5000) { // 5초 이상 경과한 경우만 새로고침
        console.log('🔄 페이지 포커스 - 데이터 새로고침')
        lastFetchTime = now
        fetchData()
      }
    }
    
    // 페이지 가시성 변경 시 새로고침 (5초 이상 경과한 경우만)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        if (now - lastFetchTime > 5000) { // 5초 이상 경과한 경우만 새로고침
          console.log('🔄 페이지 가시성 변경 - 데이터 새로고침')
          lastFetchTime = now
          fetchData()
        }
      }
    }
    
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">의약품 구매</h1>
          <p className="text-gray-600">
            관리자가 승인한 판매 요청 제품 목록입니다.
          </p>
        </div>

        {/* 검색 및 정렬 영역 */}
        {products.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* 검색 바 */}
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="상품명, 제조사, 규격으로 검색..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* 정렬 옵션 */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="date">등록일순</option>
                  <option value="name">상품명순</option>
                  <option value="price">가격순</option>
                  <option value="quantity">수량순</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* 검색 결과 카운트 */}
            {searchQuery && (
              <div className="mt-3 text-sm text-gray-600">
                검색 결과: <span className="font-semibold">{filteredProducts.length}</span>개
                {filteredProducts.length !== products.length && (
                  <span className="ml-2 text-gray-400">
                    (전체 {products.length}개 중)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {products.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 상품이 없습니다</h3>
            <p className="text-gray-500 mb-4">
              관리자가 승인한 판매 요청이 아직 없습니다.
            </p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>• 판매자가 판매 리스트를 제출하고</p>
              <p>• 관리자가 승인하면 상품이 여기에 표시됩니다.</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
            <p className="text-gray-500 mb-4">
              다른 검색어를 입력해보세요.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              검색 초기화
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* 데스크톱: 게시판 형식 */}
            <div className="hidden md:block overflow-x-auto">
              {/* 게시판 헤더 */}
              <div className="bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-11 gap-4 px-6 py-3 text-sm font-semibold text-gray-700 min-w-[1100px]">
                  <div className="col-span-2">상품명</div>
                  <div className="col-span-1">규격</div>
                  <div className="col-span-1">제조사</div>
                  <div className="col-span-1">유효기간</div>
                  <div className="col-span-1 text-center">수량</div>
                  <div className="col-span-1 text-right">보험가</div>
                  <div className="col-span-1 text-right">판매가</div>
                  <div className="col-span-1 text-center">할인율</div>
                  <div className="col-span-2 text-center">등록일</div>
                </div>
              </div>

              {/* 게시판 목록 */}
              <div className="divide-y divide-gray-200">
                {filteredProducts.map((product: any) => (
                  <div key={product.id}>
                    <div
                      className="grid grid-cols-11 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors min-w-[1100px]"
                    >
                    <div className="col-span-2">
                      <div className="font-medium text-gray-900">
                        {product.product_name}
                      </div>
                      {product.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {product.description}
                        </div>
                      )}
                    </div>
                    <div className="col-span-1 text-sm text-gray-600">
                      {product.specification || '-'}
                    </div>
                    <div className="col-span-1 text-sm text-gray-600">
                      {product.manufacturer || '-'}
                    </div>
                    <div className="col-span-1 text-sm text-gray-600">
                      {product.expiry_date 
                        ? new Date(product.expiry_date).toLocaleDateString('ko-KR')
                        : '-'
                      }
                    </div>
                    <div className="col-span-1 text-sm text-gray-900 text-center">
                      {product.quantity}개
                    </div>
                    <div className="col-span-1 text-sm text-gray-500 text-right">
                      {product.insurance_price 
                        ? (
                          <span className="line-through">
                            {product.insurance_price.toLocaleString()}원
                          </span>
                        )
                        : '-'
                      }
                    </div>
                    <div className="col-span-1 text-sm font-semibold text-blue-600 text-right">
                      {product.selling_price.toLocaleString()}원
                    </div>
                    <div className="col-span-1 text-sm text-center">
                      {product.discount_rate ? (
                        <span className="font-medium text-red-600">
                          {product.discount_rate.toFixed(1)}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </div>
                    <div className="col-span-2 text-xs text-gray-500 text-center">
                      {new Date(product.created_at).toLocaleDateString('ko-KR')}
                    </div>
                    </div>
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {(() => {
                            const purchaseRequest = purchaseRequests.get(product.id)
                            if (purchaseRequest && (purchaseRequest.status === 'pending' || purchaseRequest.status === 'confirmed')) {
                              return (
                                <>
                                  <button
                                    disabled
                                    className="inline-flex items-center px-4 py-2 bg-gray-400 text-white text-sm font-medium rounded-md cursor-not-allowed"
                                  >
                                    거래중
                                  </button>
                                  <button
                                    onClick={() => handleCancelPurchaseRequest(purchaseRequest.id)}
                                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                                  >
                                    구매 요청 취소
                                  </button>
                                </>
                              )
                            }
                            return (
                              <Link
                                href={`/products/${product.id}/purchase`}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                              >
                                구매 요청
                              </Link>
                            )
                          })()}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteProduct(product.id, product.product_name)}
                            disabled={deletingProductId === product.id}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingProductId === product.id ? '삭제 중...' : '삭제'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 모바일: 간소화된 목록 형식 */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredProducts.map((product: any) => (
                <div
                  key={product.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {product.product_name}
                    </h3>
                    {product.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                      <span className="text-gray-500">규격:</span>{' '}
                      <span className="text-gray-900">{product.specification || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">제조사:</span>{' '}
                      <span className="text-gray-900">{product.manufacturer || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">유효기간:</span>{' '}
                      <span className="text-gray-900">
                        {product.expiry_date 
                          ? new Date(product.expiry_date).toLocaleDateString('ko-KR')
                          : '-'
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">수량:</span>{' '}
                      <span className="text-gray-900">{product.quantity}개</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      {product.insurance_price && (
                        <div className="text-xs text-gray-500 line-through mb-1">
                          보험가: {product.insurance_price.toLocaleString()}원
                        </div>
                      )}
                      <div className="text-lg font-bold text-blue-600">
                        {product.selling_price.toLocaleString()}원
                      </div>
                      {product.discount_rate && (
                        <div className="text-xs text-red-600 font-medium">
                          할인율: {product.discount_rate.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">
                        {new Date(product.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  </div>
                  
                  {/* 모바일 구매 요청 버튼 */}
                  <div className="pt-3 border-t border-gray-100">
                    {(() => {
                      const purchaseRequest = purchaseRequests.get(product.id)
                      if (purchaseRequest && (purchaseRequest.status === 'pending' || purchaseRequest.status === 'confirmed')) {
                        return (
                          <div className="flex flex-col space-y-2">
                            <button
                              disabled
                              className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-400 text-white text-sm font-medium rounded-md cursor-not-allowed"
                            >
                              거래중
                            </button>
                            <button
                              onClick={() => handleCancelPurchaseRequest(purchaseRequest.id)}
                              className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                            >
                              구매 요청 취소
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteProduct(product.id, product.product_name)}
                                disabled={deletingProductId === product.id}
                                className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingProductId === product.id ? '삭제 중...' : '관리자: 상품 삭제'}
                              </button>
                            )}
                          </div>
                        )
                      }
                      return (
                        <div className="flex flex-col space-y-2">
                          <Link
                            href={`/products/${product.id}/purchase`}
                            className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                          >
                            구매 요청
                          </Link>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteProduct(product.id, product.product_name)}
                              disabled={deletingProductId === product.id}
                              className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingProductId === product.id ? '삭제 중...' : '관리자: 상품 삭제'}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


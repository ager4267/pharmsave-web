'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { Product, Profile } from '@/lib/types'

export default function PurchaseRequestPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState<number>(1)
  const [shippingAddress, setShippingAddress] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [params.id])

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

      // 3. 상품 정보 조회
      const productId = params.id as string
      const response = await fetch('/api/products/list')
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && Array.isArray(result.products)) {
          const foundProduct = result.products.find((p: Product) => p.id === productId)
          if (foundProduct) {
            setProduct(foundProduct)
          } else {
            setError('상품을 찾을 수 없습니다.')
          }
        } else {
          setError('상품 정보를 불러올 수 없습니다.')
        }
      } else {
        setError('상품 정보를 불러올 수 없습니다.')
      }
    } catch (error: any) {
      console.error('오류:', error)
      setError(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleQuantityChange = (value: number) => {
    if (!product) return
    
    const numValue = Math.max(1, Math.min(value, product.quantity))
    setQuantity(numValue)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      if (!product) {
        setError('상품 정보가 없습니다.')
        setSubmitting(false)
        return
      }

      // 수량 검증
      if (quantity <= 0) {
        setError('수량은 1개 이상이어야 합니다.')
        setSubmitting(false)
        return
      }

      if (quantity > product.quantity) {
        setError(`구매 수량이 판매 수량을 초과할 수 없습니다. (최대: ${product.quantity}개)`)
        setSubmitting(false)
        return
      }

      // 구매 요청 제출
      const response = await fetch('/api/purchase-requests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: quantity,
          shippingAddress: shippingAddress || null,
          userId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(true)
        // 2초 후 구매 페이지로 이동
        setTimeout(() => {
          router.push('/products')
        }, 2000)
      } else {
        setError(result.error || '구매 요청 제출에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('구매 요청 오류:', error)
      setError(`구매 요청 제출 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

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

  if (error && !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">오류 발생</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Link
                href="/products"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                구매 페이지로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="text-green-600 text-6xl mb-4">✓</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">구매 요청 완료</h2>
              <p className="text-gray-600 mb-4">구매 요청이 성공적으로 제출되었습니다.</p>
              <p className="text-sm text-gray-500 mb-4">잠시 후 구매 페이지로 이동합니다...</p>
              <Link
                href="/products"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                구매 페이지로 이동
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return null
  }

  const totalPrice = Number(product.selling_price) * quantity
  const maxQuantity = product.quantity

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <Link
            href="/products"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← 구매 페이지로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">구매 요청</h1>
        </div>

        {/* 상품 정보 카드 */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">상품 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">상품명</label>
              <p className="text-lg font-semibold text-gray-900">{product.product_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">규격</label>
              <p className="text-gray-900">{product.specification || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">제조사</label>
              <p className="text-gray-900">{product.manufacturer || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">유효기간</label>
              <p className="text-gray-900">
                {product.expiry_date 
                  ? new Date(product.expiry_date).toLocaleDateString('ko-KR')
                  : '-'
                }
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">판매 수량</label>
              <p className="text-gray-900">{product.quantity}개</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">단가</label>
              <p className="text-lg font-semibold text-blue-600">
                {Number(product.selling_price).toLocaleString()}원
              </p>
            </div>
          </div>
        </div>

        {/* 구매 요청 폼 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">구매 정보</h2>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* 구매 수량 */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                구매 수량 <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-md border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  -
                </button>
                <input
                  type="number"
                  id="quantity"
                  min="1"
                  max={maxQuantity}
                  value={quantity}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= maxQuantity}
                  className="w-10 h-10 rounded-md border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  +
                </button>
                <span className="text-sm text-gray-500">
                  (최대 {maxQuantity}개)
                </span>
              </div>
              {quantity > maxQuantity && (
                <p className="mt-1 text-sm text-red-600">
                  구매 수량이 판매 수량을 초과할 수 없습니다.
                </p>
              )}
            </div>

            {/* 요청사항 */}
            <div>
              <label htmlFor="shippingAddress" className="block text-sm font-medium text-gray-700 mb-2">
                요청사항 (선택)
              </label>
              <textarea
                id="shippingAddress"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="요청사항을 입력하세요"
              />
            </div>

            {/* 총 금액 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">단가</span>
                <span className="text-gray-900">
                  {Number(product.selling_price).toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">수량</span>
                <span className="text-gray-900">{quantity}개</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">총 금액</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {totalPrice.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>

            {/* 제출 버튼 */}
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={submitting || quantity <= 0 || quantity > maxQuantity}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? '제출 중...' : '구매 요청 제출'}
              </button>
              <Link
                href="/products"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                취소
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}


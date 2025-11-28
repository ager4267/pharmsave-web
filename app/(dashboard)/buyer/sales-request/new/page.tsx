'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SalesListItem, Profile } from '@/lib/types'
import * as XLSX from 'xlsx'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function NewBuyerSalesRequestPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [items, setItems] = useState<SalesListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

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
    } catch (error) {
      console.error('오류:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExcelFile(file)
    setError(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet) as any[]

      const parsedItems: SalesListItem[] = data.map((row) => {
        // 할인율 계산 (보험가가 있는 경우)
        let discountRate: number | undefined
        if (row['보험가'] && row['판매가']) {
          const insurancePrice = parseFloat(row['보험가']) || 0
          const sellingPrice = parseFloat(row['판매가']) || 0
          if (insurancePrice > 0) {
            discountRate = ((insurancePrice - sellingPrice) / insurancePrice) * 100
          }
        }

        // 유효기간 날짜 형식 변환 (yyyy-mm-dd)
        let expiryDate = row['유효기간'] || row['expiry_date'] || ''
        if (expiryDate) {
          // Excel 날짜 숫자 형식인 경우 변환
          if (typeof expiryDate === 'number') {
            // Excel 날짜는 1900-01-01부터의 일수
            const excelEpoch = new Date(1900, 0, 1)
            const date = new Date(excelEpoch.getTime() + (expiryDate - 2) * 24 * 60 * 60 * 1000)
            expiryDate = date.toISOString().split('T')[0] // yyyy-mm-dd 형식
          } else if (typeof expiryDate === 'string') {
            // 문자열인 경우 다양한 형식 변환 시도
            const dateStr = expiryDate.trim()
            // yyyy-mm-dd 형식이 아닌 경우 변환 시도
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              const date = new Date(dateStr)
              if (!isNaN(date.getTime())) {
                expiryDate = date.toISOString().split('T')[0] // yyyy-mm-dd 형식
              } else {
                // 변환 실패 시 빈 문자열로 설정 (필수 검증에서 걸림)
                expiryDate = ''
              }
            }
          }
        }

        return {
          product_name: row['제품명'] || row['product_name'] || '',
          specification: row['규격'] || row['specification'] || '',
          manufacturer: row['제조사'] || row['manufacturer'] || '',
          manufacturing_number: row['제조번호'] || row['manufacturing_number'] || '',
          expiry_date: expiryDate,
          quantity: parseInt(row['수량'] || row['quantity'] || '0', 10),
          insurance_price: row['보험가'] || row['insurance_price'] ? parseFloat(row['보험가'] || row['insurance_price'] || '0') : undefined,
          selling_price: parseFloat(row['판매가'] || row['selling_price'] || '0'),
          discount_rate: discountRate,
          storage_condition: row['보관조건'] || row['storage_condition'] || '',
          description: row['설명'] || row['description'] || '',
        }
      }).filter(item => item.product_name && item.quantity > 0 && item.expiry_date && item.expiry_date.trim() !== '')

      if (parsedItems.length === 0) {
        setError('유효한 데이터를 찾을 수 없습니다. 엑셀 파일 형식을 확인해주세요.')
        return
      }

      setItems(parsedItems)
    } catch (err) {
      setError('엑셀 파일을 읽는 중 오류가 발생했습니다.')
      console.error(err)
    }
  }

  const handleManualAdd = () => {
    setItems([...items, {
      product_name: '',
      specification: '',
      manufacturer: '',
      manufacturing_number: '',
      expiry_date: '',
      quantity: 1,
      selling_price: 0,
      storage_condition: '',
      description: '',
    }])
  }

  // 유효기간 자동 포맷팅 함수 (숫자만 입력 시 yyyy-mm-dd로 변환)
  const formatExpiryDate = (input: string): string => {
    // 숫자와 하이픈만 허용
    const cleaned = input.replace(/[^\d-]/g, '')
    
    // 하이픈 제거 후 숫자만 추출
    const numbers = cleaned.replace(/-/g, '')
    
    // 8자리 숫자인 경우 자동 포맷팅
    if (numbers.length === 8) {
      return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`
    }
    
    // 입력 중인 경우 자동 포맷팅
    if (numbers.length > 0 && numbers.length <= 8) {
      let formatted = numbers.slice(0, 4) // 년도
      if (numbers.length > 4) {
        formatted += '-' + numbers.slice(4, 6) // 월
      }
      if (numbers.length > 6) {
        formatted += '-' + numbers.slice(6, 8) // 일
      }
      return formatted
    }
    
    // 이미 yyyy-mm-dd 형식인 경우 그대로 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return cleaned
    }
    
    return cleaned
  }

  const handleItemChange = (index: number, field: keyof SalesListItem, value: any) => {
    const newItems = [...items]
    const item = { ...newItems[index] } as any

    if (field === 'quantity' || field === 'selling_price' || field === 'insurance_price') {
      item[field] = parseFloat(value) || 0
    } else if (field === 'expiry_date') {
      // 유효기간 필드인 경우 자동 포맷팅 적용
      item[field] = formatExpiryDate(value)
    } else {
      item[field] = value
    }

    // 할인율 자동 계산
    if (field === 'insurance_price' || field === 'selling_price') {
      if (item.insurance_price && item.selling_price && item.insurance_price > 0) {
        item.discount_rate = ((item.insurance_price - item.selling_price) / item.insurance_price) * 100
      } else {
        item.discount_rate = undefined
      }
    }

    newItems[index] = item
    setItems(newItems)
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (items.length === 0) {
      setError('최소 1개 이상의 상품을 추가해주세요.')
      return
    }

    // 유효성 검사
    for (const item of items) {
      if (!item.product_name || !item.selling_price || item.quantity <= 0) {
        setError('모든 필수 항목을 입력해주세요.')
        return
      }
      // 유효기간 필수 검증
      if (!item.expiry_date || item.expiry_date.trim() === '') {
        setError('유효기간은 필수 입력 항목입니다. 모든 상품의 유효기간을 입력해주세요.')
        return
      }
      // 날짜 형식 검증 (yyyy-mm-dd)
      if (item.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(item.expiry_date)) {
        setError('유효기간은 yyyy-mm-dd 형식으로 입력해주세요. (예: 2024-12-31)')
        return
      }
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // API를 통해 판매 리스트 생성 (자동 승인 및 상품 등록)
      const response = await fetch('/api/seller/create-sales-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerId: user.id, // buyer의 경우에도 자신의 id를 seller_id에 저장
          items: items,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || '판매 요청 제출 중 오류가 발생했습니다.')
        return
      }

      if (result.warning) {
        console.warn('경고:', result.warning)
      }

      setSuccess(result.message || '판매 요청이 성공적으로 생성되었습니다.')
      setTimeout(() => {
        router.push('/buyer/sales-request')
      }, 1500)
    } catch (err) {
      setError('판매 요청 제출 중 오류가 발생했습니다.')
      console.error(err)
    } finally {
      setLoading(false)
    }
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
                <h1 className="text-2xl font-bold text-gray-900">판매 요청 작성</h1>
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
        <div className="bg-white rounded-lg shadow p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              엑셀 파일 업로드 (선택사항)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-sm text-gray-500">
              엑셀 파일 형식: 제품명, 규격, 제조사, 제조번호, 유효기간(yyyy-mm-dd 형식, 필수), 수량, 보험가, 판매가, 보관조건, 설명
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">상품 목록 ({items.length}개)</h2>
              <button
                type="button"
                onClick={handleManualAdd}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                상품 추가
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>엑셀 파일을 업로드하거나 상품을 직접 추가해주세요.</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold">상품 {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">제품명 *</label>
                        <input
                          type="text"
                          value={item.product_name}
                          onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">규격</label>
                        <input
                          type="text"
                          value={item.specification}
                          onChange={(e) => handleItemChange(index, 'specification', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">제조사</label>
                        <input
                          type="text"
                          value={item.manufacturer}
                          onChange={(e) => handleItemChange(index, 'manufacturer', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">제조번호</label>
                        <input
                          type="text"
                          value={item.manufacturing_number}
                          onChange={(e) => handleItemChange(index, 'manufacturing_number', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          유효기간 * <span className="text-xs text-gray-500">(yyyy-mm-dd 또는 yyyymmdd)</span>
                        </label>
                        <input
                          type="text"
                          value={item.expiry_date}
                          onChange={(e) => handleItemChange(index, 'expiry_date', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                          placeholder="20250505 또는 2025-05-05"
                          maxLength={10}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">수량 *</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">보험가</label>
                        <input
                          type="number"
                          min="0"
                          value={item.insurance_price || ''}
                          onChange={(e) => handleItemChange(index, 'insurance_price', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">판매가 *</label>
                        <input
                          type="number"
                          min="0"
                          value={item.selling_price}
                          onChange={(e) => handleItemChange(index, 'selling_price', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      {item.discount_rate !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">할인율</label>
                          <input
                            type="text"
                            value={`${item.discount_rate.toFixed(2)}%`}
                            disabled
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">보관조건</label>
                        <input
                          type="text"
                          value={item.storage_condition}
                          onChange={(e) => handleItemChange(index, 'storage_condition', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">설명</label>
                        <textarea
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Link
                href="/buyer/sales-request"
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={loading || items.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '제출 중...' : '판매 요청 제출'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


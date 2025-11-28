'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function AdminSalesListsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [salesLists, setSalesLists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [selectedSalesLists, setSelectedSalesLists] = useState<Set<string>>(new Set())
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
        await fetchSalesLists()
      } catch (error) {
        console.error('오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // 필터 변경 시 선택 초기화
    setSelectedSalesLists(new Set())
  }, [router, supabase, filter])

  const fetchSalesLists = async () => {
    try {
      let query = supabase
        .from('sales_lists')
        .select('*, profiles:profiles!sales_lists_seller_id_fkey(email, company_name, role)')
        .order('submitted_at', { ascending: false })

      if (filter === 'pending') {
        query = query.eq('status', 'pending')
      } else if (filter === 'approved') {
        query = query.eq('status', 'approved')
      } else if (filter === 'rejected') {
        query = query.eq('status', 'rejected')
      }

      const { data, error } = await query

      if (error) {
        console.error('판매 리스트 조회 오류:', error)
        return
      }

      setSalesLists(data || [])
    } catch (error) {
      console.error('오류:', error)
    }
  }

  const handleStatusChange = async (listId: string, status: 'approved' | 'rejected') => {
    if (!confirm(`판매 요청을 ${status === 'approved' ? '승인' : '거부'}하시겠습니까?`)) {
      return
    }

    try {
      setError(null)
      setSuccess(null)
      setWarning(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다.')
        return
      }

      const response = await fetch('/api/admin/approve-sales-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listId, status, adminUserId: user.id }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || '상태 업데이트에 실패했습니다.')
        return
      }

      if (result.warning) {
        let warningMsg = result.message || `판매 요청이 ${status === 'approved' ? '승인' : '거부'}되었습니다.`
        if (result.warning) {
          warningMsg += ` (경고: ${result.warning})`
        }
        if (result.error) {
          warningMsg += ` (오류: ${result.error})`
        }
        setWarning(warningMsg)
      } else {
        let message = result.message || `판매 요청이 ${status === 'approved' ? '승인' : '거부'}되었습니다.`
        if (status === 'approved' && result.insertedCount !== undefined) {
          message += ` (등록된 상품 수: ${result.insertedCount}개)`
        }
        setSuccess(message)
      }

      await fetchSalesLists()
      
      // 승인된 경우 products 페이지가 열려있다면 새로고침하도록 알림
      if (status === 'approved' && result.insertedCount > 0) {
        console.log('✅ 상품 등록 완료:', result.insertedCount, '개')
        // 다른 탭에서 products 페이지가 열려있다면 자동으로 새로고침됨 (focus 이벤트)
      }
    } catch (error) {
      console.error('오류:', error)
      setError('오류가 발생했습니다.')
    }
  }

  const handleDelete = async (listId: string, status: string) => {
    const statusText = status === 'rejected' ? '거부된' : '판매 완료된'
    if (!confirm(`${statusText} 판매 리스트를 삭제하시겠습니까?`)) {
      return
    }

    try {
      setError(null)
      setSuccess(null)
      setWarning(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다.')
        return
      }

      const response = await fetch('/api/admin/delete-sales-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ salesListId: listId, adminUserId: user.id }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || '삭제에 실패했습니다.')
        return
      }

      setSuccess(result.message || '판매 리스트가 삭제되었습니다.')
      await fetchSalesLists()
      setSelectedSalesLists(new Set())
    } catch (error) {
      console.error('오류:', error)
      setError('오류가 발생했습니다.')
    }
  }

  // 필터링된 판매 리스트 (삭제 가능한 것만)
  const deletableSalesLists = salesLists.filter(
    (list) => list.status === 'rejected' || list.status === 'approved'
  )

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSalesLists(new Set(deletableSalesLists.map((list) => list.id)))
    } else {
      setSelectedSalesLists(new Set())
    }
  }

  // 개별 선택/해제
  const handleSelect = (listId: string, checked: boolean) => {
    const newSelected = new Set(selectedSalesLists)
    if (checked) {
      newSelected.add(listId)
    } else {
      newSelected.delete(listId)
    }
    setSelectedSalesLists(newSelected)
  }

  // 일괄 삭제
  const handleBatchDelete = async () => {
    if (selectedSalesLists.size === 0) {
      setError('삭제할 판매 리스트를 선택해주세요.')
      return
    }

    const selectedCount = selectedSalesLists.size
    if (!confirm(`선택한 ${selectedCount}개의 판매 리스트를 삭제하시겠습니까?`)) {
      return
    }

    try {
      setError(null)
      setSuccess(null)
      setWarning(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다.')
        return
      }

      const response = await fetch('/api/admin/delete-sales-lists-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          salesListIds: Array.from(selectedSalesLists), 
          adminUserId: user.id 
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || '삭제에 실패했습니다.')
        if (result.errors && result.errors.length > 0) {
          setWarning(result.errors.join('; '))
        }
        return
      }

      setSuccess(result.message || '판매 리스트가 삭제되었습니다.')
      if (result.errors && result.errors.length > 0) {
        setWarning(result.errors.join('; '))
      }
      
      await fetchSalesLists()
      setSelectedSalesLists(new Set())
    } catch (error) {
      console.error('오류:', error)
      setError('오류가 발생했습니다.')
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
              <h1 className="text-2xl font-bold text-gray-900">판매 요청 관리</h1>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
        {warning && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
            {warning}
          </div>
        )}
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
          </div>
        </div>

        {/* 일괄 삭제 버튼 */}
        {deletableSalesLists.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedSalesLists.size === deletableSalesLists.length && deletableSalesLists.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">전체 선택</span>
              </label>
              <span className="text-sm text-gray-500">
                {selectedSalesLists.size > 0 && `${selectedSalesLists.size}개 선택됨`}
              </span>
            </div>
            {selectedSalesLists.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
              >
                선택한 {selectedSalesLists.size}개 삭제
              </button>
            )}
          </div>
        )}

        {/* 판매 리스트 목록 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectedSalesLists.size === deletableSalesLists.length && deletableSalesLists.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  제출자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  역할
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상품 수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  제출일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {salesLists.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    판매 요청이 없습니다.
                  </td>
                </tr>
              ) : (
                salesLists.map((list) => {
                  const userRole = list.profiles?.role || 'unknown'
                  const isBuyer = userRole === 'buyer'
                  // 관리자는 관리자 전용 상세보기 페이지로 이동
                  const detailPath = `/admin/sales-lists/${list.id}`
                  const itemsCount = Array.isArray(list.items) ? list.items.length : 0
                  const isDeletable = list.status === 'rejected' || list.status === 'approved'
                  const isSelected = selectedSalesLists.has(list.id)
                  
                  return (
                    <tr key={list.id} className={isSelected ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isDeletable && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelect(list.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCompanyName(list.profiles?.company_name, '-')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          isBuyer
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {isBuyer ? '구매자' : '판매자'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {itemsCount}개
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          list.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : list.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {list.status === 'approved'
                            ? '승인됨'
                            : list.status === 'rejected'
                            ? '거부됨'
                            : '대기 중'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {list.submitted_at
                          ? new Date(list.submitted_at).toLocaleDateString('ko-KR')
                          : list.created_at
                          ? new Date(list.created_at).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {list.status === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleStatusChange(list.id, 'approved')}
                              className="text-green-600 hover:text-green-900"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleStatusChange(list.id, 'rejected')}
                              className="text-red-600 hover:text-red-900"
                            >
                              거부
                            </button>
                          </div>
                        )}
                        {(list.status === 'rejected' || list.status === 'approved') && (
                          <button
                            onClick={() => handleDelete(list.id, list.status)}
                            className="text-red-600 hover:text-red-900 mr-2"
                          >
                            삭제
                          </button>
                        )}
                        <Link
                          href={detailPath}
                          className="text-blue-600 hover:text-blue-900 ml-2"
                        >
                          상세보기
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


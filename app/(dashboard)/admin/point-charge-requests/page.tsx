'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'

interface PointChargeRequest {
  id: string
  user_id: string
  requested_amount: number
  requested_points: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  description: string | null
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
  completed_at: string | null
  user?: {
    company_name: string
    email: string
    phone_number: string | null
  }
  admin?: {
    company_name: string
    email: string
  }
}

export default function AdminPointChargeRequestsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<PointChargeRequest[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedRequest, setSelectedRequest] = useState<PointChargeRequest | null>(null)
  const [adminNotes, setAdminNotes] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [filterStatus])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // 프로필 정보 가져오기 (최초 1회만)
      if (!profile) {
        const response = await fetch('/api/admin/get-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.profile) {
            if (result.profile.role !== 'admin') {
              router.push('/seller/dashboard')
              return
            }
            setProfile(result.profile as Profile)
          }
        }
      }

      // 포인트 충전 요청 조회 (필터 변경 시마다 최신 데이터 가져오기)
      await fetchRequests()
    } catch (error) {
      console.error('오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRequests = async () => {
    try {
      const url = filterStatus === 'all' 
        ? '/api/admin/point-charge-requests'
        : `/api/admin/point-charge-requests?status=${filterStatus}`
      
      // 캐시 완전 무시를 위해 timestamp와 여러 헤더 추가
      const timestamp = Date.now()
      const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_t=${timestamp}&_r=${Math.random()}`, {
        cache: 'no-store',
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          // 필터 상태와 일치하는 데이터만 설정
          const filteredData = result.data || []
          console.log(`📋 필터: ${filterStatus}, 조회된 데이터: ${filteredData.length}개`, {
            filterStatus,
            dataCount: filteredData.length,
            statuses: filteredData.map((r: PointChargeRequest) => ({ id: r.id, status: r.status })),
          })
          setRequests(filteredData)
        } else {
          console.error('❌ API 응답 실패:', result.error)
          setRequests([])
        }
      } else {
        console.error('❌ HTTP 오류:', response.status, response.statusText)
        setRequests([])
      }
    } catch (error) {
      console.error('❌ 충전 요청 조회 오류:', error)
      setRequests([])
    }
  }

  const handleApprove = async (request: PointChargeRequest) => {
    if (!confirm(`${request.user?.company_name}님의 ${request.requested_amount.toLocaleString()}원(${request.requested_points.toLocaleString()}p) 충전 요청을 승인하시겠습니까?`)) {
      return
    }

    // 현재 사용자 ID 가져오기
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    setProcessing(true)
    try {
      const response = await fetch(`/api/admin/point-charge-requests/${request.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          adminNotes: adminNotes || null,
          adminUserId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('포인트 충전 요청이 승인되었습니다.')
        setSelectedRequest(null)
        setAdminNotes('')
        // 서버에서 최신 데이터 가져오기 (로컬 상태 업데이트 제거 - 서버 데이터로 완전히 교체)
        await fetchRequests()
      } else {
        alert(result.error || '포인트 충전 요청 승인에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('승인 오류:', error)
      alert('승인 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (request: PointChargeRequest) => {
    if (!confirm(`${request.user?.company_name}님의 ${request.requested_amount.toLocaleString()}원(${request.requested_points.toLocaleString()}p) 충전 요청을 거부하시겠습니까?`)) {
      return
    }

    // 현재 사용자 ID 가져오기
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    setProcessing(true)
    try {
      const response = await fetch(`/api/admin/point-charge-requests/${request.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          adminNotes: adminNotes || null,
          adminUserId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('포인트 충전 요청이 거부되었습니다.')
        setSelectedRequest(null)
        setAdminNotes('')
        // 서버에서 최신 데이터 가져오기 (로컬 상태 업데이트 제거 - 서버 데이터로 완전히 교체)
        await fetchRequests()
      } else {
        alert(result.error || '포인트 충전 요청 거부에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('거부 오류:', error)
      alert('거부 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    }
    const labels = {
      pending: '대기 중',
      approved: '승인됨',
      rejected: '거부됨',
      cancelled: '취소됨',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/admin/dashboard"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← 관리자 대시보드로
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">포인트 충전 요청 관리</h1>
          <p className="mt-2 text-gray-600">사용자들의 포인트 충전 요청을 승인하거나 거부합니다.</p>
        </div>

        {/* 필터 */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filterStatus === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              대기 중
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filterStatus === 'approved'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              승인됨
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filterStatus === 'rejected'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              거부됨
            </button>
          </div>
        </div>

        {/* 요청 목록 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    요청일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    사용자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    금액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    포인트
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    처리일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(request.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium text-gray-900">
                          {request.user?.company_name || '-'}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {request.user?.email || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {request.requested_amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {request.requested_points.toLocaleString()}p
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {request.reviewed_at
                        ? new Date(request.reviewed_at).toLocaleString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {request.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedRequest(request)
                              setAdminNotes('')
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            처리
                          </button>
                        </div>
                      )}
                      {request.status !== 'pending' && request.admin_notes && (
                        <button
                          onClick={() => {
                            setSelectedRequest(request)
                            setAdminNotes(request.admin_notes || '')
                          }}
                          className="text-gray-600 hover:text-gray-800 text-xs"
                        >
                          메모 보기
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {requests.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">충전 요청이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 처리 모달 */}
      {selectedRequest && selectedRequest.status === 'pending' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              포인트 충전 요청 처리
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">사용자</p>
                <p className="font-medium text-gray-900">
                  {selectedRequest.user?.company_name} ({selectedRequest.user?.email})
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">요청 금액</p>
                <p className="font-medium text-gray-900">
                  {selectedRequest.requested_amount.toLocaleString()}원 = {selectedRequest.requested_points.toLocaleString()}p
                </p>
              </div>
              {selectedRequest.description && (
                <div>
                  <p className="text-sm text-gray-600">요청 사유</p>
                  <p className="text-gray-900">{selectedRequest.description}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  관리자 메모 (선택사항)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="승인/거부 사유를 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-2 pt-4">
                <button
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {processing ? '처리 중...' : '승인'}
                </button>
                <button
                  onClick={() => handleReject(selectedRequest)}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {processing ? '처리 중...' : '거부'}
                </button>
                <button
                  onClick={() => {
                    setSelectedRequest(null)
                    setAdminNotes('')
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 메모 보기 모달 */}
      {selectedRequest && selectedRequest.status !== 'pending' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              처리 내역
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">상태</p>
                <p className="font-medium">{getStatusBadge(selectedRequest.status)}</p>
              </div>
              {selectedRequest.admin_notes && (
                <div>
                  <p className="text-sm text-gray-600">관리자 메모</p>
                  <p className="text-gray-900">{selectedRequest.admin_notes}</p>
                </div>
              )}
              {selectedRequest.reviewed_at && (
                <div>
                  <p className="text-sm text-gray-600">처리일시</p>
                  <p className="text-gray-900">
                    {new Date(selectedRequest.reviewed_at).toLocaleString('ko-KR')}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedRequest(null)
                  setAdminNotes('')
                }}
                className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


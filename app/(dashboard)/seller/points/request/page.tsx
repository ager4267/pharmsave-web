'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import SellerNav from '../../components/SellerNav'

interface PointChargeRequest {
  id: string
  requested_amount: number
  requested_points: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  description: string | null
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
  completed_at: string | null
}

interface AdminProfile {
  company_name: string
  bank_name: string | null
  account_number: string | null
  phone_number: string | null
}

export default function PointChargeRequestPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pointsBalance, setPointsBalance] = useState<number | null>(null)
  const [chargeAmount, setChargeAmount] = useState<string>('')
  const [requesting, setRequesting] = useState(false)
  const [requests, setRequests] = useState<PointChargeRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      if (!supabase || !supabase.auth) {
        console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
        router.push('/login')
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError) {
        console.error('❌ 사용자 조회 오류:', userError)
        router.push('/login')
        return
      }

      if (!user) {
        router.push('/login')
        return
      }

      // 프로필 정보 가져오기
      const response = await fetch('/api/admin/get-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.profile) {
          if (result.profile.role === 'admin') {
            router.push('/admin/dashboard')
            return
          }
          setProfile(result.profile as Profile)
        }
      }

      // 포인트 잔액 조회
      const pointsResponse = await fetch('/api/admin/get-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      if (pointsResponse.ok) {
        const pointsResult = await pointsResponse.json()
        if (pointsResult.success) {
          setPointsBalance(pointsResult.data.balance)
        }
      }

      // 내 포인트 충전 요청 조회
      await fetchRequests()

      // 관리자 계좌 정보 조회
      const adminResponse = await fetch('/api/admin/get-admin-profile')
      if (adminResponse.ok) {
        const adminResult = await adminResponse.json()
        if (adminResult.success && adminResult.profile) {
          setAdminProfile(adminResult.profile)
        }
      }
    } catch (error) {
      console.error('오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRequests = async () => {
    setLoadingRequests(true)
    try {
      if (!supabase || !supabase.auth) {
        console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
        setLoadingRequests(false)
        return
      }

      // 현재 사용자 ID 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('❌ 사용자 조회 오류:', userError)
        setLoadingRequests(false)
        return
      }

      if (!user) {
        setLoadingRequests(false)
        return
      }

      const response = await fetch(`/api/point-charge-requests/my-requests?userId=${user.id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setRequests(result.data || [])
        }
      }
    } catch (error) {
      console.error('충전 요청 조회 오류:', error)
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleRequest = async () => {
    if (!chargeAmount) {
      alert('충전 금액을 입력해주세요.')
      return
    }

    const amount = parseInt(chargeAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('충전 금액은 0보다 큰 정수여야 합니다.')
      return
    }

    if (!confirm(`${amount.toLocaleString()}원(${amount.toLocaleString()}p) 충전을 요청하시겠습니까?\n\n관리자 승인 후 포인트가 충전됩니다.`)) {
      return
    }

    // Supabase 클라이언트 확인
    if (!supabase || !supabase.auth) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
      alert('시스템 오류가 발생했습니다. 페이지를 새로고침해주세요.')
      return
    }

    // 현재 사용자 ID 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ 사용자 조회 오류:', userError)
      alert('로그인 상태를 확인할 수 없습니다. 다시 로그인해주세요.')
      router.push('/login')
      return
    }

    if (!user) {
      alert('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    setRequesting(true)
    try {
      const response = await fetch('/api/point-charge-requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount,
          description: `포인트 충전 요청: ${amount.toLocaleString()}원 = ${amount.toLocaleString()}p`,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('포인트 충전 요청이 생성되었습니다.\n관리자 승인 후 포인트가 충전됩니다.')
        setChargeAmount('')
        await fetchRequests()
      } else {
        const errorMsg = result.error || '포인트 충전 요청 생성에 실패했습니다.'
        const details = result.details ? `\n\n상세: ${result.details}` : ''
        const hint = result.hint ? `\n\n힌트: ${result.hint}` : ''
        alert(errorMsg + details + hint)
        console.error('포인트 충전 요청 실패:', result)
      }
    } catch (error: any) {
      console.error('포인트 충전 요청 오류:', error)
      alert('포인트 충전 요청 중 오류가 발생했습니다.')
    } finally {
      setRequesting(false)
    }
  }

  const handleCancel = async (requestId: string) => {
    if (!confirm('이 충전 요청을 취소하시겠습니까?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('point_charge_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('status', 'pending')

      if (error) {
        throw error
      }

      alert('충전 요청이 취소되었습니다.')
      await fetchRequests()
    } catch (error: any) {
      console.error('충전 요청 취소 오류:', error)
      alert('충전 요청 취소에 실패했습니다.')
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

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SellerNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/seller/profile"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← 개인정보로
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">포인트 충전 요청</h1>
          <p className="mt-2 text-gray-600">포인트 충전을 요청하고 관리자 승인을 기다립니다.</p>
        </div>

        {/* 현재 포인트 잔액 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">현재 포인트 잔액</h2>
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600">
              {pointsBalance !== null ? pointsBalance.toLocaleString() : '0'}p
            </p>
            <p className="mt-2 text-sm text-gray-500">
              * 포인트는 중개 수수료 전용입니다. (1원 = 1p, 환불/양도/현금화 불가)
            </p>
          </div>
        </div>

        {/* 관리자 입금 계좌 정보 */}
        {adminProfile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">입금 계좌 정보</h2>
            <div className="space-y-2">
              <div className="flex items-start">
                <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">예금주:</span>
                <span className="text-sm text-gray-900">{adminProfile.company_name}</span>
              </div>
              {adminProfile.bank_name && (
                <div className="flex items-start">
                  <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">은행:</span>
                  <span className="text-sm text-gray-900">{adminProfile.bank_name}</span>
                </div>
              )}
              {adminProfile.account_number && (
                <div className="flex items-start">
                  <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">계좌번호:</span>
                  <span className="text-sm text-gray-900 font-mono">{adminProfile.account_number}</span>
                </div>
              )}
              {adminProfile.phone_number && (
                <div className="flex items-start">
                  <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">연락처:</span>
                  <span className="text-sm text-gray-900">{adminProfile.phone_number}</span>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-gray-600">
                  * 위 계좌로 입금하신 후 충전 요청을 해주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 포인트 충전 요청 폼 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">새 충전 요청</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                충전 금액 (원)
              </label>
              <input
                type="number"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="충전할 금액을 입력하세요"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {chargeAmount && !isNaN(parseInt(chargeAmount)) && (
                <p className="mt-1 text-sm text-gray-600">
                  충전될 포인트: {parseInt(chargeAmount).toLocaleString()}p (1원 = 1p)
                </p>
              )}
            </div>
            <button
              onClick={handleRequest}
              disabled={requesting || !chargeAmount}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {requesting ? '요청 중...' : '충전 요청하기'}
            </button>
          </div>
        </div>

        {/* 충전 요청 내역 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">충전 요청 내역</h2>
          {loadingRequests ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">로딩 중...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">충전 요청 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      요청일
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
                      관리자 메모
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(request.created_at).toLocaleDateString('ko-KR')}
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
                          ? new Date(request.reviewed_at).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {request.admin_notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {request.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(request.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            취소
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyName } from '@/lib/utils/format-company-name'

interface Deposit {
  id: string
  user_id: string
  requested_amount: number
  requested_points: number
  status: string
  description: string | null
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
  completed_at: string | null
  user?: {
    company_name: string
    email: string
  }
  admin?: {
    company_name: string
    email: string
  }
}

interface Transaction {
  id: string
  user_id: string
  transaction_type: string
  amount: number
  balance_before: number
  balance_after: number
  reference_type: string | null
  reference_id: string | null
  description: string | null
  admin_user_id: string | null
  created_at: string
  user?: {
    company_name: string
    email: string
  }
  admin?: {
    company_name: string
    email: string
  }
}

interface Statistics {
  totalDeposits: number
  totalDepositPoints: number
  totalChargePoints: number
  totalDeductPoints: number
  totalRefundPoints: number
  depositCount: number
  transactionCount: number
  chargeCount: number
  deductCount: number
  refundCount: number
}

export default function AdminLedgerPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [users, setUsers] = useState<Array<{ id: string; company_name: string; email: string }>>([])
  const [loadingData, setLoadingData] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (profile) {
      fetchLedger()
      fetchUsers()
    }
  }, [profile, selectedUserId, startDate, endDate])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

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
          if (result.profile.role !== 'admin') {
            router.push('/seller/dashboard')
            return
          }
          setProfile(result.profile as Profile)
        }
      }
    } catch (error) {
      console.error('오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/get-all-users')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.users) {
          setUsers(result.users)
        }
      }
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error)
    }
  }

  const fetchLedger = async () => {
    setLoadingData(true)
    try {
      const params = new URLSearchParams()
      if (selectedUserId) {
        params.append('userId', selectedUserId)
      }
      if (startDate) {
        params.append('startDate', startDate)
      }
      if (endDate) {
        params.append('endDate', endDate)
      }

      // credentials: 'include'를 명시적으로 설정하여 쿠키 전달 보장
      const response = await fetch(`/api/admin/ledger?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const result = await response.json()
      
      // 디버깅: 응답 확인
      if (!result.success) {
        console.error('❌ [원장조회] API 오류:', result.error)
      }

      if (result.success && result.data) {
        setDeposits(result.data.deposits || [])
        setTransactions(result.data.transactions || [])
        setStatistics(result.data.statistics || null)
      } else {
        alert(result.error || '원장 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('원장 조회 오류:', error)
      alert('원장 조회 중 오류가 발생했습니다.')
    } finally {
      setLoadingData(false)
    }
  }

  const handleReset = () => {
    setSelectedUserId('')
    setStartDate('')
    setEndDate('')
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
          <h1 className="text-3xl font-bold text-gray-900">원장 조회</h1>
          <p className="mt-2 text-gray-600">사용자의 입금 내역과 포인트 충전 내역을 확인합니다.</p>
        </div>

        {/* 필터 섹션 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">필터</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사용자 선택
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 사용자</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {formatCompanyName(user.company_name)} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleReset}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                초기화
              </button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        {statistics && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">입금</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">입금 건수</dt>
                      <dd className="text-lg font-medium text-gray-900">{statistics.depositCount}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">원</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">총 입금액</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {statistics.totalDeposits.toLocaleString()}원
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">P</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">입금 포인트</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {statistics.totalDepositPoints.toLocaleString()}p
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">충전</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">충전 포인트</dt>
                      <dd className="text-lg font-medium text-green-600">
                        +{statistics.totalChargePoints?.toLocaleString() || 0}p
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">사용</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">사용 포인트</dt>
                      <dd className="text-lg font-medium text-red-600">
                        -{statistics.totalDeductPoints?.toLocaleString() || 0}p
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">거래</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">거래 건수</dt>
                      <dd className="text-lg font-medium text-gray-900">{statistics.transactionCount}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 입금 내역 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">입금 내역</h2>
          {loadingData ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">로딩 중...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      일시
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      사용자
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      입금액
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      포인트
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      설명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      승인일시
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      승인자
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deposits.map((deposit) => (
                    <tr key={deposit.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(deposit.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {deposit.user
                          ? `${formatCompanyName(deposit.user.company_name)} (${deposit.user.email})`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {deposit.requested_amount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">
                        +{deposit.requested_points.toLocaleString()}p
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {deposit.description || deposit.admin_notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {deposit.reviewed_at
                          ? new Date(deposit.reviewed_at).toLocaleString('ko-KR')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {deposit.admin
                          ? formatCompanyName(deposit.admin.company_name)
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deposits.length === 0 && (
                <p className="text-center text-gray-500 py-8">입금 내역이 없습니다.</p>
              )}
            </div>
          )}
        </div>

        {/* 포인트 사용 내역 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">포인트 사용 내역</h2>
          {loadingData ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">로딩 중...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      일시
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      사용자
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      유형
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      포인트
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      잔액 (변경 전 → 후)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      설명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      처리자
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(tx.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {tx.user
                          ? `${formatCompanyName(tx.user.company_name)} (${tx.user.email})`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            tx.transaction_type === 'charge'
                              ? 'bg-green-100 text-green-800'
                              : tx.transaction_type === 'deduct'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {tx.transaction_type === 'charge'
                            ? '충전'
                            : tx.transaction_type === 'deduct'
                            ? '사용'
                            : '환불'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${
                        tx.transaction_type === 'charge'
                          ? 'text-green-600'
                          : tx.transaction_type === 'deduct'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }`}>
                        {tx.transaction_type === 'charge' ? '+' : '-'}
                        {tx.amount.toLocaleString()}p
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.balance_before.toLocaleString()}p → {tx.balance_after.toLocaleString()}p
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {tx.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.admin ? formatCompanyName(tx.admin.company_name) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <p className="text-center text-gray-500 py-8">포인트 사용 내역이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


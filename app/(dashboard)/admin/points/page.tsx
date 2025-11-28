'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'

interface UserPoints {
  userId: string
  companyName: string
  email: string
  balance: number
}

interface PointTransaction {
  id: string
  user_id: string
  transaction_type: 'charge' | 'deduct' | 'refund'
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
}

export default function AdminPointsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserPoints[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [chargeAmount, setChargeAmount] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [charging, setCharging] = useState(false)
  const [transactions, setTransactions] = useState<PointTransaction[]>([])
  const [showTransactions, setShowTransactions] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

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

      // 모든 사용자 목록 조회
      await fetchUsers()
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
          // 각 사용자의 포인트 조회
          const usersWithPoints = await Promise.all(
            result.users.map(async (user: any) => {
              const pointsResponse = await fetch('/api/admin/get-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
              })
              if (pointsResponse.ok) {
                const pointsResult = await pointsResponse.json()
                return {
                  userId: user.id,
                  companyName: user.company_name,
                  email: user.email,
                  balance: pointsResult.success ? pointsResult.data.balance : 0,
                }
              }
              return {
                userId: user.id,
                companyName: user.company_name,
                email: user.email,
                balance: 0,
              }
            })
          )
          setUsers(usersWithPoints)
        }
      }
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error)
    }
  }

  const handleCharge = async () => {
    if (!selectedUserId || !chargeAmount) {
      alert('사용자와 충전 금액을 선택해주세요.')
      return
    }

    const amount = parseInt(chargeAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('충전 금액은 0보다 큰 정수여야 합니다.')
      return
    }

    if (!confirm(`${users.find(u => u.userId === selectedUserId)?.companyName}님에게 ${amount.toLocaleString()}원(${amount.toLocaleString()}p)을 충전하시겠습니까?`)) {
      return
    }

    setCharging(true)
    try {
      const response = await fetch('/api/admin/charge-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          amount,
          description: description || `관리자 포인트 충전 (${amount.toLocaleString()}원 = ${amount.toLocaleString()}p)`,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`포인트 충전이 완료되었습니다.\n\n충전 전: ${result.data.balanceBefore.toLocaleString()}p\n충전 후: ${result.data.balanceAfter.toLocaleString()}p`)
        setChargeAmount('')
        setDescription('')
        setSelectedUserId('')
        await fetchUsers()
      } else {
        alert(result.error || '포인트 충전에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('포인트 충전 오류:', error)
      alert('포인트 충전 중 오류가 발생했습니다.')
    } finally {
      setCharging(false)
    }
  }

  const fetchTransactions = async (userId?: string) => {
    try {
      const { data, error } = await supabase
        .from('point_transactions')
        .select(`
          *,
          user:profiles!point_transactions_user_id_fkey(company_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      if (userId) {
        const filtered = data.filter((t: any) => t.user_id === userId)
        setTransactions(filtered as PointTransaction[])
      } else {
        setTransactions(data as PointTransaction[])
      }
      setShowTransactions(true)
    } catch (error) {
      console.error('거래 내역 조회 오류:', error)
      alert('거래 내역을 불러올 수 없습니다.')
    }
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
          <h1 className="text-3xl font-bold text-gray-900">포인트 관리</h1>
          <p className="mt-2 text-gray-600">사용자 포인트 충전 및 거래 내역 조회</p>
        </div>

        {/* 포인트 충전 섹션 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">포인트 충전</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사용자 선택
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">사용자를 선택하세요</option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.companyName} ({user.email}) - 현재: {user.balance.toLocaleString()}p
                  </option>
                ))}
              </select>
            </div>
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
              <p className="mt-1 text-xs text-gray-500">
                * 1원 = 1p (포인트는 수수료 전용, 환불/양도/현금화 불가)
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명 (선택사항)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="충전 사유를 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={handleCharge}
                disabled={charging || !selectedUserId || !chargeAmount}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {charging ? '충전 중...' : '포인트 충전하기'}
              </button>
            </div>
          </div>
        </div>

        {/* 사용자 포인트 목록 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">사용자 포인트 현황</h2>
            <button
              onClick={() => fetchTransactions()}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              전체 거래 내역 조회
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    회사명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    이메일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    포인트 잔액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.userId}>
                    <td className="px-4 py-3 text-sm text-gray-900">{user.companyName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {user.balance.toLocaleString()}p
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => fetchTransactions(user.userId)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        거래 내역
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 거래 내역 모달 */}
        {showTransactions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">포인트 거래 내역</h3>
                <button
                  onClick={() => setShowTransactions(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
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
                        금액
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        잔액 (변경 전 → 후)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        설명
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
                          {(tx.user as any)?.company_name || '-'}
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
                              ? '차감'
                              : '환불'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {tx.transaction_type === 'deduct' ? '-' : '+'}
                          {tx.amount.toLocaleString()}p
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {tx.balance_before.toLocaleString()}p → {tx.balance_after.toLocaleString()}p
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {tx.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {transactions.length === 0 && (
                  <p className="text-center text-gray-500 py-8">거래 내역이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


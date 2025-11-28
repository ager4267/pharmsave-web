'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'

export default function AdminUsersPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
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
        await fetchUsers()
      } catch (error) {
        console.error('오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, supabase, filter])

  const fetchUsers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter === 'pending') {
        query = query.eq('license_verification_status', 'pending')
      } else if (filter === 'approved') {
        query = query.eq('license_verification_status', 'approved')
      } else if (filter === 'rejected') {
        query = query.eq('license_verification_status', 'rejected')
      }

      const { data, error } = await query

      if (error) {
        console.error('사용자 조회 오류:', error)
        
        // RLS 정책 오류인 경우 API를 통해 조회
        if (error.message.includes('row-level security') || 
            error.message.includes('RLS') ||
            error.message.includes('permission denied')) {
          console.log('RLS 정책 오류 감지, API를 통해 조회 시도...')
          
          try {
            const apiUrl = filter === 'all' 
              ? '/api/admin/get-all-users'
              : `/api/admin/get-pending-users?status=${filter}`
            
            const response = await fetch(apiUrl)
            const result = await response.json()
            
            if (result.success) {
              setUsers(result.users || [])
              return
            } else {
              console.error('API 조회 오류:', result.error)
            }
          } catch (apiError) {
            console.error('API 호출 오류:', apiError)
          }
        }
        
        return
      }

      setUsers(data || [])
    } catch (error) {
      console.error('오류:', error)
    }
  }

  const handleVerificationStatus = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ license_verification_status: status })
        .eq('id', userId)

      if (error) {
        console.error('상태 업데이트 오류:', error)
        alert('상태 업데이트에 실패했습니다.')
        return
      }

      alert(`인증 상태가 ${status === 'approved' ? '승인' : '거부'}되었습니다.`)
      await fetchUsers()
    } catch (error) {
      console.error('오류:', error)
      alert('오류가 발생했습니다.')
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`정말로 사용자 "${userEmail}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          adminUserId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message || '사용자가 삭제되었습니다.')
        await fetchUsers()
      } else {
        alert(result.error || '사용자 삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('사용자 삭제 오류:', error)
      alert('사용자 삭제 중 오류가 발생했습니다.')
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
              <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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

        {/* 사용자 목록 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  회사명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사업자등록번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  역할
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  인증 상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.company_name && user.company_name !== '임시회사명'
                        ? user.company_name
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.business_number && !user.business_number.startsWith('TEMP-')
                        ? user.business_number
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role === 'admin' ? '관리자' : '판매자/구매자'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.license_verification_status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : user.license_verification_status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.license_verification_status === 'approved'
                          ? '승인됨'
                          : user.license_verification_status === 'rejected'
                          ? '거부됨'
                          : '대기 중'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {user.license_verification_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleVerificationStatus(user.id, 'approved')}
                              className="text-green-600 hover:text-green-900"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleVerificationStatus(user.id, 'rejected')}
                              className="text-red-600 hover:text-red-900"
                            >
                              거부
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="text-red-600 hover:text-red-900 font-medium"
                          title="사용자 삭제"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function AdminVerificationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([])
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
        await fetchPendingUsers()
      } catch (error) {
        console.error('오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, supabase])

  const fetchPendingUsers = async () => {
    try {
      // 먼저 직접 쿼리 시도
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('license_verification_status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('사용자 조회 오류 (직접 쿼리):', error)
        
        // RLS 정책 오류인 경우 API를 통해 조회
        if (error.message.includes('row-level security') || 
            error.message.includes('RLS') ||
            error.message.includes('permission denied')) {
          console.log('RLS 정책 오류 감지, API를 통해 조회 시도...')
          
          try {
            const response = await fetch('/api/admin/get-pending-users')
            const result = await response.json()
            
            if (result.success) {
              setPendingUsers(result.users || [])
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

      setPendingUsers(data || [])
    } catch (error) {
      console.error('오류:', error)
    }
  }

  const handleVerification = async (userId: string, status: 'approved' | 'rejected') => {
    if (!confirm(`인증을 ${status === 'approved' ? '승인' : '거부'}하시겠습니까?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ license_verification_status: status })
        .eq('id', userId)

      if (error) {
        console.error('상태 업데이트 오류:', error)
        alert('인증 상태 업데이트에 실패했습니다.')
        return
      }

      alert(`인증이 ${status === 'approved' ? '승인' : '거부'}되었습니다.`)
      await fetchPendingUsers()
    } catch (error) {
      console.error('오류:', error)
      alert('오류가 발생했습니다.')
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
              <h1 className="text-2xl font-bold text-gray-900">인증 승인</h1>
            </div>
            <div className="text-sm text-gray-500">
              대기 중인 인증: {pendingUsers.length}건
            </div>
          </div>
        </div>
      </div>

      {/* 대기 중인 인증 목록 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pendingUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">대기 중인 인증 요청이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {pendingUsers.map((user) => (
              <div key={user.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {formatCompanyName(user.company_name, '회사명 없음')}
                    </h3>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">이메일:</span> {user.email}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">사업자등록번호:</span> {user.business_number || '-'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">전화번호:</span> {user.phone_number || '-'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">주소:</span> {user.address || '-'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">도매업 허가증 번호:</span> {user.wholesale_license || '-'}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">가입일:</span>{' '}
                        {user.created_at
                          ? new Date(user.created_at).toLocaleString('ko-KR')
                          : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleVerification(user.id, 'approved')}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleVerification(user.id, 'rejected')}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                    >
                      거부
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
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
      } catch (error) {
        console.error('오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, supabase])

  const handleResetTestData = async () => {
    if (!confirm('⚠️ 경고: 관리자를 제외한 모든 사용자 데이터가 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) {
      return
    }

    if (!confirm('정말로 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다!')) {
      return
    }

    setResetting(true)

    try {
      const response = await fetch('/api/admin/reset-test-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (result.success) {
        const totalDeleted = result.totalDeleted || 0
        alert(`✅ 초기화 완료!\n\n총 ${totalDeleted}개 항목이 삭제되었습니다.\n관리자 ${result.adminCount}명은 보존되었습니다.`)
        window.location.reload()
      } else {
        alert(`❌ 초기화 실패: ${result.error}`)
      }
    } catch (error: any) {
      console.error('초기화 오류:', error)
      alert('초기화 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setResetting(false)
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
              <h1 className="text-2xl font-bold text-gray-900">시스템 설정</h1>
            </div>
          </div>
        </div>
      </div>

      {/* 설정 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">시스템 정보</h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">시스템 이름</dt>
                <dd className="mt-1 text-sm text-gray-900">팜세이브 (PharmSave)</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">버전</dt>
                <dd className="mt-1 text-sm text-gray-900">1.0.0</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">데이터베이스</dt>
                <dd className="mt-1 text-sm text-gray-900">Supabase PostgreSQL</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">프레임워크</dt>
                <dd className="mt-1 text-sm text-gray-900">Next.js 14</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">관리자 계정 정보</h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">이메일</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile?.email || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">회사명</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatCompanyName(profile?.company_name)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">사업자등록번호</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile?.business_number || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">역할</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                    관리자
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">시스템 설정</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">이메일 알림</h3>
                  <p className="text-sm text-gray-500">회원가입 및 판매 리스트 알림</p>
                </div>
                <span className="text-sm text-gray-500">활성화됨</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">자동 승인</h3>
                  <p className="text-sm text-gray-500">판매 리스트 자동 승인</p>
                </div>
                <span className="text-sm text-gray-500">비활성화됨</span>
              </div>
            </div>
          </div>
        </div>

        {/* 테스트 데이터 초기화 */}
        <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-red-900 mb-2">테스트 데이터 초기화</h2>
                <p className="text-sm text-red-700 mb-4">
                  관리자를 제외한 모든 사용자 데이터와 관련 데이터를 삭제합니다.
                  <br />
                  <span className="font-semibold">⚠️ 이 작업은 되돌릴 수 없습니다!</span>
                </p>
                <div className="text-xs text-red-600 space-y-1">
                  <p>• 삭제 대상: 사용자 프로필, 판매 리스트, 상품, 구매 요청, 포인트 등</p>
                  <p>• 보존 대상: 관리자 계정 및 관련 데이터</p>
                  <p>• 참고: Supabase Auth 사용자는 별도로 삭제해야 합니다</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleResetTestData}
                disabled={resetting}
                className="btn btn-danger px-6 py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    초기화 중...
                  </>
                ) : (
                  '🗑️ 테스트 데이터 초기화 실행'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">참고사항</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>시스템 설정 기능은 향후 구현 예정입니다.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


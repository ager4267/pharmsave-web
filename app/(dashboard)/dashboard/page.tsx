'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/types'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔍 대시보드 로드 시작...')
        
        // 1. 사용자 인증 확인
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError) {
          console.error('❌ 사용자 조회 오류:', userError)
          setError(`사용자 조회 실패: ${userError.message}`)
          setLoading(false)
          return
        }

        if (!user) {
          console.log('⚠️ 사용자가 없습니다. 로그인 페이지로 이동합니다.')
          router.push('/login')
          return
        }

        console.log('✅ 사용자 확인됨:', user.id, user.email)

        // 2. API를 통해 프로필 조회 (서버 사이드 - RLS 우회)
        console.log('🔍 API를 통해 프로필 조회 시도...')
        try {
          const controller = new AbortController()
          const apiTimeoutId = setTimeout(() => controller.abort(), 8000) // 8초 타임아웃
          
          const response = await fetch('/api/admin/get-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: user.id }),
            signal: controller.signal,
          })
          
          clearTimeout(apiTimeoutId)

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const result = await response.json()
          console.log('📦 API 응답:', result)

          if (result.success && result.profile) {
            const apiProfile = result.profile
            console.log('✅ API를 통해 프로필 조회 성공:', apiProfile)
            
            // 역할에 따라 리다이렉트
            if (apiProfile.role === 'admin') {
              console.log('🔀 관리자 대시보드로 이동...')
              router.push('/admin/dashboard')
              return
            } else {
              // 일반 사용자는 판매자이면서 구매자 - 판매자 대시보드로 이동
              console.log('🔀 판매자/구매자 대시보드로 이동...')
              router.push('/seller/dashboard')
              return
            }
            
            setProfile(apiProfile as Profile)
          } else {
            console.error('❌ API 프로필 조회 실패:', result.error)
            setError(`프로필 조회 실패: ${result.error || '알 수 없는 오류'}`)
            setLoading(false)
            return
          }
        } catch (apiError: any) {
          console.error('❌ API 호출 오류:', apiError)
          setError(`프로필 조회 실패: ${apiError.message || '알 수 없는 오류'}`)
          setLoading(false)
          return
        }
      } catch (error: any) {
        console.error('❌ 오류:', error)
        setError(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`)
        setLoading(false)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">오류 발생</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">프로필을 불러오는 중...</p>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
              <p className="text-sm text-gray-500 mt-1">
                {formatCompanyName(profile.company_name, '-')} ({profile.email})
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 환영 메시지 */}
        <div className="bg-white shadow rounded-lg mb-8 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">환영합니다!</h2>
          <p className="text-gray-600">
            팜세이브에 오신 것을 환영합니다.
          </p>
          <p className="text-gray-600 mt-2">
            계정 승인을 기다리고 있습니다. 승인되면 해당 역할에 맞는 대시보드로 이동할 수 있습니다.
          </p>
        </div>

        {/* 계정 상태 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">계정 상태</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">회사명</span>
                <span className="text-sm text-gray-900">{formatCompanyName(profile.company_name)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">이메일</span>
                <span className="text-sm text-gray-900">{profile.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">사업자등록번호</span>
                <span className="text-sm text-gray-900">{profile.business_number || '없음'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">역할</span>
                <span className="text-sm text-gray-900">
                  {profile.role === 'admin' 
                    ? '관리자' 
                    : '판매자/구매자'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">인증 상태</span>
                <span className={`text-sm font-medium ${
                  profile.license_verification_status === 'approved' 
                    ? 'text-green-600' 
                    : profile.license_verification_status === 'pending'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  {profile.license_verification_status === 'approved' 
                    ? '승인됨' 
                    : profile.license_verification_status === 'pending'
                    ? '대기 중'
                    : '거부됨'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


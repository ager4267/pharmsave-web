'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingVerifications: 0,
    totalProducts: 0,
    totalSalesLists: 0,
  })
  const router = useRouter()
  const supabase = createClient()

  const fetchStats = async () => {
    try {
      console.log('📊 통계 정보 조회 시작...')
      
      // API를 통해 통계 조회 (서버 사이드 - RLS 우회)
      try {
        const [usersResponse, verificationsResponse] = await Promise.all([
          fetch('/api/admin/get-all-users'),
          fetch('/api/admin/get-pending-users'),
        ])

        if (usersResponse.ok) {
          const usersResult = await usersResponse.json()
          if (usersResult.success) {
            setStats(prev => ({
              ...prev,
              totalUsers: usersResult.count || 0,
            }))
          }
        }

        if (verificationsResponse.ok) {
          const verificationsResult = await verificationsResponse.json()
          if (verificationsResult.success) {
            setStats(prev => ({
              ...prev,
              pendingVerifications: verificationsResult.count || 0,
            }))
          }
        }
      } catch (apiError) {
        console.error('❌ 통계 API 호출 오류:', apiError)
        // API 실패해도 기본값 유지
      }
      
      console.log('✅ 통계 정보 조회 완료')
    } catch (statsError) {
      console.error('❌ 통계 조회 오류:', statsError)
      // 통계 조회 실패해도 계속 진행 (기본값 0 사용)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔍 관리자 대시보드 로드 시작...')
        
        // 타임아웃 설정 (10초)
        const timeoutId = setTimeout(() => {
          console.error('⏰ 타임아웃: 데이터 로드 시간 초과')
          setError('데이터 로드를 불러오는 데 시간이 너무 오래 걸립니다. 페이지를 새로고침해주세요.')
          setLoading(false)
        }, 10000)
        
        // 1. 사용자 인증 확인
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError) {
          console.error('❌ 사용자 조회 오류:', userError)
          clearTimeout(timeoutId)
          setError(`사용자 조회 실패: ${userError.message}`)
          setLoading(false)
          return
        }

        if (!user) {
          console.log('⚠️ 사용자가 없습니다. 로그인 페이지로 이동합니다.')
          clearTimeout(timeoutId)
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
            const errorText = await response.text()
            console.error('❌ API 응답 오류:', response.status, errorText)
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
          }

          const result = await response.json()
          console.log('📦 API 응답:', result)

          if (result.success && result.profile) {
            const apiProfile = result.profile
            console.log('✅ API를 통해 프로필 조회 성공:', apiProfile)
            
            // 관리자 권한 확인
            if (apiProfile.role !== 'admin') {
              console.error('❌ 관리자 권한이 없습니다. 역할:', apiProfile.role)
              clearTimeout(timeoutId)
              setError(`관리자 권한이 없습니다. 현재 역할: ${apiProfile.role}`)
              setLoading(false)
              return
            }

            console.log('✅ 관리자 프로필 확인됨:', apiProfile)
            setProfile(apiProfile as Profile)
            
            // 통계 조회 (오류가 나도 계속 진행)
            try {
              await fetchStats()
            } catch (statsError) {
              console.error('❌ 통계 조회 오류:', statsError)
              // 통계 조회 실패해도 계속 진행
            }
            
            clearTimeout(timeoutId)
            setLoading(false)
          } else {
            console.error('❌ API 프로필 조회 실패:', result.error)
            clearTimeout(timeoutId)
            setError(`프로필 조회 실패: ${result.error || '알 수 없는 오류'}`)
            setLoading(false)
            return
          }
        } catch (apiError: any) {
          console.error('❌ API 호출 오류:', apiError)
          
          // 타임아웃 오류인 경우
          if (apiError.name === 'AbortError') {
            console.error('⏰ API 호출 타임아웃')
            clearTimeout(timeoutId)
            setError('API 호출 시간이 초과되었습니다. 페이지를 새로고침해주세요.')
            setLoading(false)
            return
          }
          
          clearTimeout(timeoutId)
          setError(`프로필 조회 실패: ${apiError.message || '알 수 없는 오류'}`)
          setLoading(false)
          return
        }
      } catch (error: any) {
        console.error('❌ 오류:', error)
        setError(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`)
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
          <p className="mt-2 text-sm text-gray-400">잠시만 기다려주세요...</p>
          <button
            onClick={() => {
              setLoading(false)
              setError('로딩이 취소되었습니다. 페이지를 새로고침해주세요.')
            }}
            className="mt-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
          >
            로딩 취소
          </button>
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
              <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
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
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">전체 사용자</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalUsers}</dd>
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
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">대기 중인 인증</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.pendingVerifications}</dd>
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
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">전체 상품</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalProducts}</dd>
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
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">판매 리스트</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalSalesLists}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 빠른 작업 */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">빠른 작업</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/admin/users"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">사용자 관리</h3>
                <p className="mt-1 text-sm text-gray-500">사용자 목록 조회 및 관리</p>
              </Link>
              <Link
                href="/admin/verifications"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">회원 가입 승인</h3>
                <p className="mt-1 text-sm text-gray-500">대기 중인 회원 가입 요청 승인</p>
              </Link>
              <Link
                href="/admin/products"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">상품 관리</h3>
                <p className="mt-1 text-sm text-gray-500">상품 목록 조회 및 관리</p>
              </Link>
              <Link
                href="/admin/sales-lists"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">판매 리스트</h3>
                <p className="mt-1 text-sm text-gray-500">판매 리스트 조회 및 승인</p>
              </Link>
              <Link
                href="/admin/purchase-requests"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">구매 요청</h3>
                <p className="mt-1 text-sm text-gray-500">구매 요청 목록 조회</p>
              </Link>
              <Link
                href="/admin/sales-approval-reports"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">판매 승인 보고서</h3>
                <p className="mt-1 text-sm text-gray-500">판매 승인 보고서 관리 및 전달</p>
              </Link>
              <Link
                href="/admin/settings"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">시스템 설정</h3>
                <p className="mt-1 text-sm text-gray-500">시스템 설정 관리</p>
              </Link>
              <Link
                href="/admin/points"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">포인트 관리</h3>
                <p className="mt-1 text-sm text-gray-500">사용자 포인트 충전 및 거래 내역 조회</p>
              </Link>
              <Link
                href="/admin/point-charge-requests"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-900">포인트 충전 요청</h3>
                <p className="mt-1 text-sm text-gray-500">사용자들의 포인트 충전 요청 승인/거부</p>
              </Link>
            </div>
          </div>
        </div>

        {/* 최근 활동 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">최근 활동</h2>
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">최근 활동이 없습니다.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


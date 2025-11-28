'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/types'
import { formatCompanyName } from '@/lib/utils/format-company-name'
import SellerNav from '../components/SellerNav'

export default function SellerDashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState({
    totalSalesLists: 0,
    pendingSalesLists: 0,
    approvedSalesLists: 0,
    totalAnalyses: 0,
    pendingReports: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      console.log('🔍 판매자 대시보드 로드 시작...')
      
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
      try {
        const response = await fetch('/api/admin/get-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.profile) {
            const apiProfile = result.profile
            console.log('✅ API를 통해 프로필 조회 성공:', apiProfile)
            
            // 관리자가 아닌 모든 사용자는 판매자이면서 구매자
            if (apiProfile.role === 'admin') {
              console.error('❌ 관리자는 이 페이지에 접근할 수 없습니다.')
              router.push('/admin/dashboard')
              return
            }

            setProfile(apiProfile as Profile)
          }
        }
      } catch (apiError) {
        console.error('❌ API 호출 오류:', apiError)
        // API 실패 시 클라이언트 사이드에서 직접 조회 시도
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (profileData) {
          setProfile(profileData as Profile)
        }
      }

      // 3. 판매 리스트 통계 조회
      const { data: salesLists } = await supabase
        .from('sales_lists')
        .select('status')
        .eq('seller_id', user.id)

      const totalSalesLists = salesLists?.length || 0
      const pendingSalesLists = salesLists?.filter((list) => list.status === 'pending').length || 0
      const approvedSalesLists = salesLists?.filter((list) => list.status === 'approved').length || 0

      // 4. 재고 분석 통계 조회
      const { data: analyses } = await supabase
        .from('inventory_analyses')
        .select('id')
        .eq('user_id', user.id)

      // 5. 판매 승인 보고서 통계 조회 (전달됨 상태인 보고서 수)
      const { data: reports } = await supabase
        .from('sales_approval_reports')
        .select('id')
        .eq('seller_id', user.id)
        .eq('status', 'sent')

      setStats({
        totalSalesLists,
        pendingSalesLists,
        approvedSalesLists,
        totalAnalyses: analyses?.length || 0,
        pendingReports: reports?.length || 0,
      })
    } catch (error) {
      console.error('❌ 오류:', error)
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">판매자 대시보드</h1>
              <p className="text-sm text-gray-500 mt-1">
                {formatCompanyName(profile?.company_name, '-')} ({profile?.email})
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

      {/* 네비게이션 바 */}
      <SellerNav />

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 빠른 작업 - 판매 요청 강조 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg mb-8 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">새 판매 요청 작성</h2>
              <p className="text-blue-100">의약품 판매 리스트를 작성하고 관리자 승인을 받으세요.</p>
            </div>
            <Link
              href="/seller/sales-list/new"
              className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-semibold shadow-md transition-colors"
            >
              판매 요청 작성
            </Link>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">총 판매 리스트</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalSalesLists}</dd>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">대기 중</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.pendingSalesLists}</dd>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">승인됨</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.approvedSalesLists}</dd>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">재고 분석</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalAnalyses}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/seller/sales-approval-reports"
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">판매 승인 보고서</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.pendingReports > 0 ? (
                        <span className="text-orange-600">{stats.pendingReports}개 대기</span>
                      ) : (
                        '0개'
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* 빠른 작업 */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">빠른 작업</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/seller/sales-list/new"
                className="block p-6 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-colors bg-blue-50"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">판매 요청 작성</h3>
                    <p className="mt-1 text-sm text-gray-500">새로운 판매 리스트를 작성하세요</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/seller/sales-list"
                className="block p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-500 rounded-md flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">판매 리스트 관리</h3>
                    <p className="mt-1 text-sm text-gray-500">판매 리스트를 조회하고 관리하세요</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/seller/inventory-analysis"
                className="block p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-purple-500 rounded-md flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">재고 분석</h3>
                    <p className="mt-1 text-sm text-gray-500">불용재고 & 유효기간 임박재고를 분석</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/seller/purchase-requests"
                className="block p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">구매 요청</h3>
                    <p className="mt-1 text-sm text-gray-500">내 상품에 대한 구매 요청을 확인하세요</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/seller/sales-approval-reports"
                className={`block p-6 border-2 rounded-lg transition-colors ${
                  stats.pendingReports > 0
                    ? 'border-orange-500 bg-orange-50 hover:bg-orange-100'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center ${
                      stats.pendingReports > 0 ? 'bg-orange-500' : 'bg-gray-500'
                    }`}>
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      판매 승인 보고서
                      {stats.pendingReports > 0 && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {stats.pendingReports}개 새 보고서
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {stats.pendingReports > 0
                        ? '관리자가 전달한 보고서를 확인하세요'
                        : '판매 승인 보고서를 확인하세요'}
                    </p>
                  </div>
                </div>
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


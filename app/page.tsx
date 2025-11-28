'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/products')
      }
    }
    checkAuth()
  }, [router, supabase])

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl mx-auto text-center animate-fade-in">
          {/* 로고/타이틀 영역 */}
          <div className="mb-12">
            <h1 className="text-5xl sm:text-6xl font-bold mb-4 gradient-text">
              팜세이브몰
            </h1>
            <p className="text-xl sm:text-2xl text-gray-700 font-medium mb-2">
              PharmSave
            </p>
            <p className="text-lg sm:text-xl text-gray-600 mb-4">
              도매사 불용재고 중개 플랫폼
            </p>
            <p className="text-sm sm:text-base text-gray-500">
              B2B 의약품 세이브 마켓
            </p>
          </div>

          {/* CTA 버튼 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <a
              href="/login"
              className="btn btn-primary px-8 py-3 text-lg shadow-lg hover-lift"
            >
              로그인
            </a>
            <a
              href="/register"
              className="btn btn-success px-8 py-3 text-lg shadow-lg hover-lift"
            >
              회원가입
            </a>
          </div>

          {/* 기능 소개 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            <div className="card p-6 hover-lift">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">회원가입 및 인증</h3>
              <p className="text-sm text-gray-600">도매업 허가증 검증을 통한 안전한 회원 관리</p>
            </div>

            <div className="card p-6 hover-lift">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">판매 리스트 제출</h3>
              <p className="text-sm text-gray-600">간편한 판매 리스트 작성 및 관리</p>
            </div>

            <div className="card p-6 hover-lift">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">상품 관리</h3>
              <p className="text-sm text-gray-600">효율적인 상품 등록 및 관리 시스템</p>
            </div>

            <div className="card p-6 hover-lift">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">구매 요청</h3>
              <p className="text-sm text-gray-600">간편한 구매 요청 제출 및 관리</p>
            </div>

            <div className="card p-6 hover-lift">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">매입-재판매</h3>
              <p className="text-sm text-gray-600">체계적인 매입-재판매 프로세스</p>
            </div>

            <div className="card p-6 hover-lift">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">재고 분석</h3>
              <p className="text-sm text-gray-600">불용 재고 및 유효기간 임박 재고 파악</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}


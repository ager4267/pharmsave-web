'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/types'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function Navigation() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    // 홈 페이지에서는 사용자 확인 후 프로필 초기화
    if (pathname === '/') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setProfile(null) // 로그아웃 상태이면 프로필 초기화
      }
      setLoading(false)
      return
    }

    try {
      // 사용자 확인 (간단하게)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        setProfile(null) // 사용자가 없으면 프로필 초기화
        setLoading(false)
        return
      }

      // API 호출 시도 (간단하게)
      try {
        const response = await fetch('/api/admin/get-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
        
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.profile) {
            const profile = result.profile as Profile
            
            // 관리자 승인 상태 확인 (관리자는 제외)
            if (profile.role !== 'admin') {
              const verificationStatus = profile.license_verification_status || 'pending'
              
              if (verificationStatus !== 'approved') {
                // 승인되지 않은 사용자는 로그아웃 처리
                console.log('❌ 관리자 승인 대기 중인 사용자, 로그아웃 처리')
                await supabase.auth.signOut()
                router.push('/login')
                setLoading(false)
                return
              }
            }
            
            setProfile(profile)
            setLoading(false)
            return
          }
        }
      } catch (apiError) {
        console.warn('⚠️ Navigation API 호출 실패, 직접 조회 시도')
      }

      // API 실패 시 직접 조회
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (!error && data) {
          const profile = data as Profile
          
          // 관리자 승인 상태 확인 (관리자는 제외)
          if (profile.role !== 'admin') {
            const verificationStatus = profile.license_verification_status || 'pending'
            
            if (verificationStatus !== 'approved') {
              // 승인되지 않은 사용자는 로그아웃 처리
              console.log('❌ 관리자 승인 대기 중인 사용자, 로그아웃 처리')
              await supabase.auth.signOut()
              router.push('/login')
              setLoading(false)
              return
            }
          }
          
          setProfile(profile)
        }
      } catch (directError) {
        console.warn('⚠️ Navigation 직접 조회 실패')
      }
    } catch (error: any) {
      console.error('❌ Navigation 프로필 조회 오류:', error.message || error)
    } finally {
      setLoading(false)
    }
  }, [supabase, pathname])

  useEffect(() => {
    // 로그인/회원가입 페이지에서는 프로필 조회하지 않음
    if (pathname === '/login' || pathname === '/register') {
      setProfile(null) // 프로필 초기화
      setLoading(false)
      return
    }

    // 홈 페이지에서는 사용자 확인 후 프로필 초기화
    if (pathname === '/') {
      const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setProfile(null) // 로그아웃 상태이면 프로필 초기화
        }
        setLoading(false)
      }
      checkUser()
      return
    }

    // 최대 2초 후 강제로 로딩 해제 (안전장치)
    const forceTimeout = setTimeout(() => {
      setLoading(false)
    }, 2000)

    fetchProfile()

    return () => {
      clearTimeout(forceTimeout)
    }
  }, [pathname, fetchProfile, supabase])

  // Supabase auth 상태 변경 감지 (로그아웃 시 프로필 초기화)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null) // 로그아웃 시 프로필 초기화
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  // 로그인/회원가입 페이지에서는 Navigation 숨기기
  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProfile(null) // 프로필 상태 초기화
    router.push('/')
  }

  // 로딩 중에도 기본 Navigation 표시 (홈 페이지가 아닌 경우에만)
  if (loading && pathname !== '/') {
    return (
      <nav className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center px-2 py-2 text-xl font-bold gradient-text">
                팜세이브몰
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/products"
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors"
                >
                  의약품 구매
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                로그인
              </Link>
            </div>
          </div>
        </div>
      </nav>
    )
  }


  if (!profile) {
    return (
      <nav className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center px-2 py-2 text-xl font-bold gradient-text">
                팜세이브몰
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/products"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    pathname === '/products'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  의약품 구매
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="btn btn-primary px-4 py-2 text-sm font-medium"
              >
                회원가입
              </Link>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link 
              href={profile ? "/products" : "/"} 
              className="flex items-center px-2 py-2 text-xl font-bold gradient-text"
            >
              팜세이브몰
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/products"
                prefetch={true}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                  pathname === '/products'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                의약품 구매
              </Link>
              {profile.role === 'admin' && (
                <Link
                  href="/admin/dashboard"
                  prefetch={true}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    pathname?.startsWith('/admin')
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  관리자 대시보드
                </Link>
              )}
              {profile.role !== 'admin' && (
                <>
                  <Link
                    href="/seller/dashboard"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      pathname?.startsWith('/seller/dashboard')
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    판매자 대시보드
                  </Link>
                  <Link
                    href="/seller/profile"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      pathname === '/seller/profile'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    개인정보
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700 font-medium hidden md:block">
              {formatCompanyName(profile.company_name, profile.email)}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}


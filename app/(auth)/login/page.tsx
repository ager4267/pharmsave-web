'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 에러 메시지를 한글로 변환하는 함수
  const translateError = (errorMessage: string): string => {
    const message = errorMessage.toLowerCase()
    
    if (message.includes('invalid login credentials') || 
        message.includes('invalid credentials') ||
        message.includes('invalid email or password')) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    }
    
    if (message.includes('email not confirmed') || 
        message.includes('email not confirmed')) {
      return '이메일이 확인되지 않았습니다.'
    }
    
    if (message.includes('too many requests') || 
        message.includes('rate limit')) {
      return '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.'
    }
    
    if (message.includes('user not found')) {
      return '등록되지 않은 이메일입니다.'
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'
    }
    
    if (message.includes('timeout')) {
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.'
    }
    
    // 기본값: 원본 메시지 반환 (한글이거나 알 수 없는 경우)
    return errorMessage
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      let user: any = null
      
      // 1. 로그인 시도
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('❌ 로그인 오류:', signInError)
        
        // 이메일 확인 오류인 경우 자동으로 이메일 확인 처리
        if (signInError.message.includes('Email not confirmed') || 
            signInError.message.includes('email not confirmed') ||
            signInError.message.includes('not confirmed')) {
          console.log('🔄 이메일 확인 오류 감지, 이메일 확인 처리 시도...')
          
          try {
            // 이메일로 이메일 확인 처리 (서버 사이드)
            const response = await fetch('/api/admin/confirm-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email }),
            })
            
            const result = await response.json()
            
            if (result.success) {
              console.log('✅ 이메일 확인 처리 성공, 다시 로그인 시도...')
              
              // 이메일 확인 후 다시 로그인 시도
              const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                email,
                password,
              })
              
              if (retryError) {
                console.error('❌ 재로그인 오류:', retryError)
                setError(translateError(retryError.message))
                setLoading(false)
                return
              }
              
              if (!retryData.user) {
                setError('로그인에 실패했습니다.')
                setLoading(false)
                return
              }
              
              // 로그인 성공
              console.log('✅ 재로그인 성공:', retryData.user.email)
              user = retryData.user
            } else {
              setError(`이메일 확인 처리 실패: ${result.error || '알 수 없는 오류'}`)
              setLoading(false)
              return
            }
          } catch (confirmError: any) {
            console.error('❌ 이메일 확인 처리 오류:', confirmError)
            setError(`이메일 확인 처리에 실패했습니다: ${confirmError.message || '알 수 없는 오류'}`)
            setLoading(false)
            return
          }
        } else {
          // 에러 메시지를 한글로 변환
          setError(translateError(signInError.message))
          setLoading(false)
          return
        }
      } else if (data.user) {
        // 로그인 성공
        console.log('✅ 로그인 성공:', data.user.email)
        user = data.user
      }

      if (!user) {
        console.error('❌ 사용자 데이터가 없습니다.')
        setError('로그인에 실패했습니다.')
        setLoading(false)
        return
      }

      // 2. 무한 재귀 방지를 위해 API를 통해 프로필 조회 (RLS 우회)
      console.log('🔍 API를 통해 프로필 조회 시도...')
      
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃
        
        const response = await fetch('/api/admin/get-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (result.success && result.profile) {
          const profile = result.profile
          console.log('✅ API를 통해 프로필 조회 성공:', profile.role)
          
          // 관리자 승인 상태 확인
          const verificationStatus = profile.license_verification_status || 'pending'
          
          if (verificationStatus !== 'approved') {
            // 승인되지 않은 사용자는 로그인 차단
            console.log('❌ 관리자 승인 대기 중인 사용자:', verificationStatus)
            
            // 로그아웃 처리
            await supabase.auth.signOut()
            
            setLoading(false)
            
            if (verificationStatus === 'rejected') {
              setError('회원가입이 거부되었습니다. 관리자에게 문의하세요.')
            } else {
              setError('관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.')
            }
            return
          }
          
          // 리다이렉트 전에 로딩 상태 해제
          setLoading(false)
          
          // 역할에 따라 리다이렉트
          if (profile.role === 'admin') {
            console.log('🔀 관리자 대시보드로 이동...')
            router.push('/admin/dashboard')
          } else {
            // 일반 사용자는 판매자이면서 구매자 - 판매자 대시보드로 이동
            console.log('🔀 판매자/구매자 대시보드로 이동...')
            router.push('/seller/dashboard')
          }
          return
        } else {
          throw new Error(result.error || '프로필 조회 실패')
        }
      } catch (apiError: any) {
        console.error('❌ API 호출 오류:', apiError)
        setError(`프로필 조회 실패: ${apiError.message || '알 수 없는 오류'}`)
        setLoading(false)
        return
      }
    } catch (err: any) {
      console.error('❌ 로그인 중 오류:', err)
      setError(err.message || '로그인 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            로그인
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            팜세이브 (PharmSave) - 도매사 불용재고 중개 플랫폼
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="이메일을 입력하세요"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="비밀번호를 입력하세요"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>

          <div className="flex justify-between items-center">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              비밀번호를 잊으셨나요?
            </Link>
            <Link
              href="/register"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              회원가입
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}


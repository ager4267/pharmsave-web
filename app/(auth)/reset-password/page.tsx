'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase 비밀번호 재설정 링크를 클릭하면 자동으로 세션이 설정됩니다
    // 초기 검증은 하지 않고, 비밀번호 변경 시도 시 오류를 처리합니다
    // URL 해시에서 access_token이 있으면 Supabase가 자동으로 처리합니다
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // 비밀번호 확인
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    // 비밀번호 길이 확인
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)

    try {
      // 세션 확인 (비밀번호 재설정 링크를 통해 접근한 경우 세션이 있어야 함)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (!session) {
        // 세션이 없으면 유효하지 않은 링크
        setError('유효하지 않은 링크입니다. 비밀번호 재설정 링크를 다시 요청해주세요.')
        setLoading(false)
        return
      }

      // Supabase 비밀번호 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        console.error('❌ 비밀번호 재설정 오류:', updateError)
        
        // 세션 만료 오류인 경우
        if (updateError.message.includes('session') || updateError.message.includes('expired') || updateError.message.includes('invalid')) {
          setError('링크가 만료되었거나 유효하지 않습니다. 비밀번호 재설정 링크를 다시 요청해주세요.')
        } else {
          setError(updateError.message || '비밀번호 재설정에 실패했습니다.')
        }
        setLoading(false)
        return
      }

      // 성공 메시지 표시
      setSuccess(true)
      setLoading(false)

      // 2초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: any) {
      console.error('❌ 오류:', err)
      setError(err.message || '비밀번호 재설정 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            비밀번호 재설정
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            팜세이브 (PharmSave) - 도매사 불용재고 중개 플랫폼
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              <p className="font-medium">비밀번호가 성공적으로 변경되었습니다.</p>
              <p className="mt-1 text-sm">
                잠시 후 로그인 페이지로 이동합니다.
              </p>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  새 비밀번호
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  새 비밀번호 확인
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="새 비밀번호를 다시 입력하세요"
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                로그인 페이지로 돌아가기
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


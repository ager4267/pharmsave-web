'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const checkSetup = async () => {
    setChecking(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/check-setup')
      const data = await response.json()

      if (response.ok) {
        setStatus(data)
      } else {
        setError(data.error || '설정 확인 중 오류가 발생했습니다.')
      }
    } catch (err: any) {
      setError(err.message || '설정 확인 중 오류가 발생했습니다.')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    checkSetup()
  }, [])

  const copySQL = () => {
    // SQL 파일 내용을 클립보드에 복사
    // 실제로는 서버에서 SQL 파일을 읽어와야 함
    alert('COMPLETE_SETUP_ALL.sql 파일을 열어서 내용을 복사하세요.')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            시스템 설정 상태
          </h1>

          {checking && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">설정 확인 중...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {status && (
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  설정 상태
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">버킷 존재:</span>
                    <span className={status.checks.bucket.exists ? 'text-green-600' : 'text-red-600'}>
                      {status.checks.bucket.exists ? '✅ 존재' : '❌ 없음'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">버킷 공개 설정:</span>
                    <span className={status.checks.bucket.isPrivate ? 'text-green-600' : 'text-yellow-600'}>
                      {status.checks.bucket.isPrivate ? '✅ 비공개' : '⚠️ 공개'}
                    </span>
                  </div>
                </div>
              </div>

              {status.success ? (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  ✅ 모든 설정이 완료되었습니다!
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
                  <p className="font-semibold mb-2">⚠️ 설정이 필요합니다</p>
                  <p className="text-sm mb-4">
                    SQL Editor에서 SQL을 실행해야 합니다.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">실행 방법:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Supabase 대시보드 → SQL Editor</li>
                      <li>COMPLETE_SETUP_ALL.sql 파일 내용 복사</li>
                      <li>SQL Editor에 붙여넣기</li>
                      <li>Run 버튼 클릭</li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={checkSetup}
                  disabled={checking}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {checking ? '확인 중...' : '다시 확인'}
                </button>
                <button
                  onClick={copySQL}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  SQL 파일 열기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


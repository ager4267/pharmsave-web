'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/types'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function SellerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    business_number: '',
    phone_number: '',
    address: '',
  })
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
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
              setProfile(apiProfile as Profile)
              // 폼 데이터 초기화
              setFormData({
                company_name: apiProfile.company_name || '',
                business_number: apiProfile.business_number || '',
                phone_number: apiProfile.phone_number || '',
                address: apiProfile.address || '',
              })
            } else {
              setError(`프로필 조회 실패: ${result.error || '알 수 없는 오류'}`)
            }
          }
        } catch (apiError: any) {
          console.error('❌ API 호출 오류:', apiError)
          setError(`프로필 조회 실패: ${apiError.message || '알 수 없는 오류'}`)
        }
      } catch (error: any) {
        console.error('❌ 오류:', error)
        setError(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`)
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

  const handleOpenProfileModal = () => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        business_number: profile.business_number || '',
        phone_number: profile.phone_number || '',
        address: profile.address || '',
      })
    }
    setShowProfileModal(true)
  }

  const handleCloseProfileModal = () => {
    setShowProfileModal(false)
    setError(null)
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다.')
        return
      }

      const response = await fetch('/api/admin/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          company_name: formData.company_name,
          business_number: formData.business_number,
          phone_number: formData.phone_number,
          address: formData.address,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // 프로필 새로고침
        const profileResponse = await fetch('/api/admin/get-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        })

        const profileResult = await profileResponse.json()
        if (profileResult.success && profileResult.profile) {
          setProfile(profileResult.profile as Profile)
        }

        setShowProfileModal(false)
        alert('프로필이 성공적으로 업데이트되었습니다.')
      } else {
        setError(result.error || '프로필 업데이트에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('프로필 업데이트 오류:', error)
      setError('프로필 업데이트 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
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

  if (error && !profile) {
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
              <h1 className="text-2xl font-bold text-gray-900">개인 정보 페이지</h1>
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
            판매자 계정으로 로그인하셨습니다. 판매 리스트를 관리하고 구매 요청을 확인할 수 있습니다.
          </p>
        </div>

        {/* 빠른 작업 */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">빠른 작업</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/seller/sales-approval-reports"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <h3 className="text-sm font-medium text-gray-900">판매 승인</h3>
                <p className="mt-1 text-sm text-gray-500">관리자가 전달한 판매 승인 보고서를 확인하세요</p>
              </Link>
              <Link
                href="/seller/sales-list"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <h3 className="text-sm font-medium text-gray-900">판매 리스트</h3>
                <p className="mt-1 text-sm text-gray-500">판매 리스트를 관리하세요</p>
              </Link>
              <button
                onClick={handleOpenProfileModal}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left cursor-pointer"
              >
                <h3 className="text-sm font-medium text-gray-900">프로필 설정</h3>
                <p className="mt-1 text-sm text-gray-500">계정 정보를 수정하세요</p>
              </button>
              <Link
                href="/seller/points/request"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <h3 className="text-sm font-medium text-gray-900">포인트 충전 요청</h3>
                <p className="mt-1 text-sm text-gray-500">포인트 충전을 요청하고 관리자 승인을 기다립니다</p>
              </Link>
              <Link
                href="/seller/points/ledger"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <h3 className="text-sm font-medium text-gray-900">원장 조회</h3>
                <p className="mt-1 text-sm text-gray-500">나의 입금 내역과 포인트 충전 내역을 확인합니다</p>
              </Link>
            </div>
          </div>
        </div>

        {/* 상태 정보 */}
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

      {/* 프로필 설정 모달 */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">프로필 설정</h2>
                <button
                  onClick={handleCloseProfileModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="px-6 py-4">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
                    회사명 *
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="business_number" className="block text-sm font-medium text-gray-700 mb-1">
                    사업자등록번호 *
                  </label>
                  <input
                    type="text"
                    id="business_number"
                    name="business_number"
                    value={formData.business_number}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    주소
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="text-sm text-gray-500">
                  <p>* 표시된 항목은 필수 입력 항목입니다.</p>
                  <p className="mt-1">이메일은 변경할 수 없습니다.</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseProfileModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


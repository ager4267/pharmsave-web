'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyNameWithEmail } from '@/lib/utils/format-company-name'
import SellerNav from '../components/SellerNav'

export default function SellerSalesApprovalReportsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // 프로필 정보 가져오기
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
          setProfile(result.profile as Profile)
        }
      }

      // 판매 승인 보고서 조회 (판매자 본인의 보고서만)
      const reportsResponse = await fetch(`/api/admin/sales-approval-reports?seller_id=${user.id}`)
      const reportsResult = await reportsResponse.json()

      if (reportsResult.success) {
        setReports(reportsResult.reports || [])
      }
    } catch (error) {
      console.error('오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmReport = async (reportId: string) => {
    if (!confirm('이 보고서를 확인하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/sales-approval-reports/${reportId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'confirm',
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('보고서를 확인했습니다.')
        await fetchData()
      } else {
        alert(result.error || '보고서 확인에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('보고서 확인 오류:', error)
      alert('보고서 확인 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      created: { label: '생성됨', className: 'bg-gray-100 text-gray-800' },
      sent: { label: '전달됨', className: 'bg-blue-100 text-blue-800' },
      confirmed: { label: '확인됨', className: 'bg-yellow-100 text-yellow-800' },
      shipped: { label: '배송 중', className: 'bg-purple-100 text-purple-800' },
      completed: { label: '완료됨', className: 'bg-green-100 text-green-800' },
    }

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">판매 승인 보고서</h1>
              <p className="text-sm text-gray-500 mt-1">
                {profile?.company_name || '-'} ({profile?.email || '-'})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 네비게이션 바 */}
      <SellerNav />

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">받은 판매 승인 보고서가 없습니다</h3>
            <p className="text-gray-600">관리자가 판매 승인 보고서를 전달하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    보고서 번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    구매자 정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    전달일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {report.report_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {report.buyer_info_revealed ? (
                        report.buyer ? (
                          formatCompanyNameWithEmail(report.buyer.company_name, report.buyer.email)
                        ) : (
                          '-'
                        )
                      ) : (
                        <span className="text-gray-400">상세보기에서 확인 가능</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.product_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {report.quantity || 0}개
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
                      {report.total_amount ? Number(report.total_amount).toLocaleString() + '원' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {report.sent_at
                        ? new Date(report.sent_at).toLocaleDateString('ko-KR')
                        : report.created_at
                        ? new Date(report.created_at).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link
                          href={`/seller/sales-approval-reports/${report.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          상세보기
                        </Link>
                        {report.status === 'sent' && (
                          <button
                            onClick={() => handleConfirmReport(report.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            확인
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


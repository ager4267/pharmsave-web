'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyNameWithEmail } from '@/lib/utils/format-company-name'

export default function SalesApprovalReportsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'created' | 'sent' | 'confirmed' | 'shipped' | 'completed'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // 프로필 정보 가져오기
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData?.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setProfile(profileData as Profile)
      await fetchReports()
    } catch (error) {
      console.error('오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.append('status', filter)
      }

      const response = await fetch(`/api/admin/sales-approval-reports?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setReports(result.reports || [])
      }
    } catch (error) {
      console.error('판매 승인 보고서 조회 오류:', error)
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('이 판매 승인 보고서를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      setDeletingId(reportId)

      const response = await fetch(`/api/admin/sales-approval-reports/${reportId}`, {
        method: 'DELETE',
      })

      // 이미 삭제되었거나 존재하지 않는 경우(404)는 성공으로 처리
      if (response.status === 404) {
        alert('이미 삭제되었거나 존재하지 않는 판매 승인 보고서입니다.\n목록을 새로 고칩니다.')
        await fetchReports()
        return
      }

      const result = await response.json()

      if (result.success) {
        alert(result.message || '판매 승인 보고서가 삭제되었습니다.')
        await fetchReports()
      } else {
        alert(result.error || '판매 승인 보고서 삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('판매 승인 보고서 삭제 오류:', error)
      alert('판매 승인 보고서 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSendReport = async (reportId: string) => {
    if (!confirm('판매자에게 이 보고서를 전달하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/sales-approval-reports/${reportId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send',
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('판매자에게 보고서가 전달되었습니다.')
        await fetchReports()
      } else {
        alert(result.error || '보고서 전달에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('보고서 전달 오류:', error)
      alert('보고서 전달 중 오류가 발생했습니다.')
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/dashboard"
                className="text-gray-500 hover:text-gray-700"
              >
                ← 대시보드
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">판매 승인 보고서</h1>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilter('created')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'created'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              생성됨
            </button>
            <button
              onClick={() => setFilter('sent')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'sent'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전달됨
            </button>
            <button
              onClick={() => setFilter('confirmed')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'confirmed'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              확인됨
            </button>
            <button
              onClick={() => setFilter('shipped')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'shipped'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              배송 중
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              완료됨
            </button>
          </div>
        </div>

        {/* 보고서 목록 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  보고서 번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  판매자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  구매자
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
                  생성일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    판매 승인 보고서가 없습니다.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {report.report_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.seller ? (
                        formatCompanyNameWithEmail(report.seller.company_name, report.seller.email)
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.buyer ? (
                        formatCompanyNameWithEmail(report.buyer.company_name, report.buyer.email)
                      ) : (
                        '-'
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
                      {report.created_at
                        ? new Date(report.created_at).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link
                          href={`/admin/sales-approval-reports/${report.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          상세보기
                        </Link>
                        {report.status === 'created' && (
                          <button
                            onClick={() => handleSendReport(report.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            전달
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={deletingId === report.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === report.id ? '삭제 중...' : '삭제'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


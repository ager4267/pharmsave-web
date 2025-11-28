'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyName } from '@/lib/utils/format-company-name'

export default function SalesApprovalReportDetailPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [params.id])

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
      await fetchReport()
    } catch (error) {
      console.error('오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/admin/sales-approval-reports/${params.id}`)
      const result = await response.json()

      if (result.success) {
        setReport(result.report)
      } else {
        alert('보고서를 불러올 수 없습니다.')
        router.push('/admin/sales-approval-reports')
      }
    } catch (error) {
      console.error('보고서 조회 오류:', error)
    }
  }

  const handleSendReport = async () => {
    if (!confirm('판매자에게 이 보고서를 전달하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/sales-approval-reports/${params.id}`, {
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
        await fetchReport()
      } else {
        alert(result.error || '보고서 전달에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('보고서 전달 오류:', error)
      alert('보고서 전달 중 오류가 발생했습니다.')
    }
  }

  const handlePrint = () => {
    window.print()
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

  if (!report) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/sales-approval-reports"
                className="text-gray-500 hover:text-gray-700"
              >
                ← 목록으로
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">판매 승인 보고서</h1>
            </div>
            <div className="flex space-x-2">
              {report.status === 'created' && (
                <button
                  onClick={handleSendReport}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  판매자에게 전달
                </button>
              )}
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                인쇄/PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 보고서 내용 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-8 print:p-4">
          {/* 보고서 헤더 */}
          <div className="text-center mb-8 border-b pb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">판매 승인 보고서</h2>
            <p className="text-lg text-gray-600">Sales Approval Report</p>
            <p className="text-sm text-gray-500 mt-2">보고서 번호: {report.report_number}</p>
          </div>

          {/* 기본 정보 */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">기본 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">생성일</label>
                <p className="text-gray-900">
                  {report.created_at
                    ? new Date(report.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">상태</label>
                <p className="text-gray-900">
                  {report.status === 'created' && '생성됨'}
                  {report.status === 'sent' && '전달됨'}
                  {report.status === 'confirmed' && '확인됨'}
                  {report.status === 'shipped' && '배송 중'}
                  {report.status === 'completed' && '완료됨'}
                </p>
              </div>
            </div>
          </div>

          {/* 판매자 정보 */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">판매자 정보</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">회사명</label>
                  <p className="text-gray-900">{formatCompanyName(report.seller?.company_name)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">이메일</label>
                  <p className="text-gray-900">{report.seller?.email || '-'}</p>
                </div>
                {report.seller?.phone_number && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">전화번호</label>
                    <p className="text-gray-900">{report.seller.phone_number}</p>
                  </div>
                )}
                {report.seller?.address && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">주소</label>
                    <p className="text-gray-900">{report.seller.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 구매자 정보 */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">구매자 정보</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">회사명</label>
                  <p className="text-gray-900 font-semibold">{formatCompanyName(report.buyer?.company_name) || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">사업자등록번호</label>
                  <p className="text-gray-900">{report.buyer?.business_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">연락처</label>
                  <p className="text-gray-900">{report.buyer?.phone_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">이메일</label>
                  <p className="text-gray-900">{report.buyer?.email || '-'}</p>
                </div>
                {report.buyer?.address && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">주소</label>
                    <p className="text-gray-900">{report.buyer.address}</p>
                  </div>
                )}
                {report.shipping_address && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">배송지 주소</label>
                    <p className="text-gray-900 font-semibold">{report.shipping_address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 상품 정보 */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">상품 정보</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">규격</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">제조사</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">단가</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">총액</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900">{report.product_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{report.product?.specification || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{report.product?.manufacturer || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{report.quantity}개</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {Number(report.unit_price).toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {Number(report.total_amount).toLocaleString()}원
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 거래 금액 안내 */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              거래 금액 안내
              <span className="text-sm font-normal text-gray-500 ml-2">
                (정산/지급: 판매자↔구매자 직접)
              </span>
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">총 거래 금액</span>
                  <span className="font-semibold text-gray-900">
                    {Number(report.total_amount).toLocaleString()}원
                    <span className="text-sm font-normal text-gray-500 ml-2">(VAT 포함)</span>
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">중개 수수료 (5%)</span>
                  <span className="text-gray-900 font-semibold">
                    {Number(report.commission).toLocaleString()}원
                    <span className="text-xs font-normal text-gray-500 ml-2">(VAT 별도, 선지급 완료)</span>
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">운영자 지급</span>
                  <span className="text-gray-900 font-medium">
                    없음
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      (정산: 판매자↔구매자 직접)
                    </span>
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">
                    판매자 예상 수취액
                    <span className="text-xs text-gray-500 ml-1">(참고)</span>
                  </span>
                  <span className="font-semibold text-gray-900">
                    {Number(report.total_amount).toLocaleString()}원
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-300">
                <div className="text-xs text-gray-600 space-y-1">
                  <p>
                    <strong>정산 책임:</strong> 본 거래의 대금지급·세금계산서 발행·환불 등 정산은{' '}
                    <strong>판매자와 구매자 간 직접 처리</strong>합니다.
                  </p>
                  <p>
                    <strong>수수료 환불:</strong> 구매자 정보 제공 후{' '}
                    <strong>수수료는 환불되지 않음</strong> (약관 §10조의8).
                  </p>
                  <p>
                    <strong>가격 체계:</strong> 총 거래 금액은 <strong>VAT 포함</strong> 기준이며, 중개 수수료는 <strong>VAT 별도</strong>입니다.
                  </p>
                  <p className="text-gray-500 italic mt-2">
                    * 참고: 실제 수취액은 배송/하자 등 개별 합의에 따라 변동될 수 있음
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 배송 정보 */}
          {report.tracking_number && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">배송 정보</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-500">운송장 번호</label>
                  <p className="text-gray-900">{report.tracking_number}</p>
                </div>
                {report.shipped_at && (
                  <div className="mt-2">
                    <label className="text-sm font-medium text-gray-500">배송일</label>
                    <p className="text-gray-900">
                      {new Date(report.shipped_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 비고 */}
          {report.notes && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">비고</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-900 whitespace-pre-wrap">{report.notes}</p>
              </div>
            </div>
          )}

          {/* 하단 서명란 */}
          <div className="mt-12 border-t pt-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-4">관리자</p>
                <div className="border-t pt-4">
                  <p className="text-gray-900">{formatCompanyName(profile?.company_name)}</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-4">판매자</p>
                <div className="border-t pt-4">
                  <p className="text-gray-900">{formatCompanyName(report.seller?.company_name)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 인쇄 스타일 */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .bg-gray-50 {
            background: white !important;
          }
          button, a {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}


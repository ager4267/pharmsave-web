'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import { formatCompanyName } from '@/lib/utils/format-company-name'
import SellerNav from '../../components/SellerNav'

export default function SellerSalesApprovalReportDetailPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pointsBalance, setPointsBalance] = useState<number | null>(null)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [buyerInfoRevealed, setBuyerInfoRevealed] = useState(false)
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

      // 판매 승인 보고서 조회
      const reportResponse = await fetch(`/api/admin/sales-approval-reports/${params.id}`)
      const reportResult = await reportResponse.json()

      if (reportResult.success) {
        // 판매자 본인의 보고서인지 확인
        if (reportResult.report.seller_id !== user.id) {
          alert('이 보고서에 접근할 권한이 없습니다.')
          router.push('/seller/sales-approval-reports')
          return
        }
        setReport(reportResult.report)
        setBuyerInfoRevealed(reportResult.report.buyer_info_revealed || false)
        
        // 포인트 잔액 조회
        const pointsResponse = await fetch('/api/admin/get-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
        if (pointsResponse.ok) {
          const pointsResult = await pointsResponse.json()
          if (pointsResult.success) {
            setPointsBalance(pointsResult.data.balance)
          }
        }
      } else {
        alert('보고서를 불러올 수 없습니다.')
        router.push('/seller/sales-approval-reports')
      }
    } catch (error) {
      console.error('오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmReport = async () => {
    if (!confirm('이 보고서를 확인하고 구매자에게 약품을 발송하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/sales-approval-reports/${params.id}`, {
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
        alert('보고서를 확인했습니다. 구매자에게 약품을 발송해주세요.')
        await fetchData()
      } else {
        alert(result.error || '보고서 확인에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('보고서 확인 오류:', error)
      alert('보고서 확인 중 오류가 발생했습니다.')
    }
  }

  const handleShipReport = async () => {
    const trackingNumber = prompt('운송장 번호를 입력해주세요:')
    if (!trackingNumber) {
      return
    }

    try {
      const response = await fetch(`/api/admin/sales-approval-reports/${params.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ship',
          tracking_number: trackingNumber,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('배송 정보가 업데이트되었습니다.')
        await fetchData()
      } else {
        alert(result.error || '배송 정보 업데이트에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('배송 정보 업데이트 오류:', error)
      alert('배송 정보 업데이트 중 오류가 발생했습니다.')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleRevealBuyerInfo = async () => {
    if (!report) return

    // 이미 구매자 정보가 노출된 경우
    if (buyerInfoRevealed) {
      return
    }

    setPointsLoading(true)
    try {
      // 포인트 차감 API 호출
      const response = await fetch('/api/admin/deduct-points-for-buyer-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesApprovalReportId: report.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        if (result.alreadyDeducted) {
          // 이미 차감된 경우
          setBuyerInfoRevealed(true)
          await fetchData()
          alert('구매자 정보가 이미 노출되었습니다.')
        } else {
          // 포인트 차감 성공
          setBuyerInfoRevealed(true)
          setPointsBalance(result.data.balanceAfter)
          await fetchData()
          alert(`포인트 ${result.data.pointsDeducted.toLocaleString()}p가 차감되었습니다.\n구매자 정보가 노출되었습니다.`)
        }
      } else {
        // 포인트 부족 오류
        if (result.code === 'INSUFFICIENT_POINTS') {
          const required = result.required || Math.round(Number(report.commission))
          const current = result.balance || pointsBalance || 0
          const shortage = required - current
          alert(
            `포인트가 부족합니다.\n\n` +
            `필요 포인트: ${required.toLocaleString()}p\n` +
            `현재 잔액: ${current.toLocaleString()}p\n` +
            `부족 금액: ${shortage.toLocaleString()}p\n\n` +
            `관리자에게 포인트 충전을 요청해주세요.`
          )
        } else {
          alert(result.error || '구매자 정보 노출에 실패했습니다.')
        }
      }
    } catch (error: any) {
      console.error('구매자 정보 노출 오류:', error)
      alert('구매자 정보 노출 중 오류가 발생했습니다.')
    } finally {
      setPointsLoading(false)
    }
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
                href="/seller/sales-approval-reports"
                className="text-gray-500 hover:text-gray-700"
              >
                ← 목록으로
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">판매 승인 보고서</h1>
            </div>
            <div className="flex space-x-2">
              {report.status === 'sent' && (
                <button
                  onClick={handleConfirmReport}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  확인 및 발송 준비
                </button>
              )}
              {report.status === 'confirmed' && (
                <button
                  onClick={handleShipReport}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  배송 정보 입력
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

      {/* 네비게이션 바 */}
      <SellerNav />

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

          {/* 포인트 정보 및 구매자 정보 노출 버튼 */}
          {!buyerInfoRevealed && (
            <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                    구매자 정보 열람 안내
                  </h3>
                  <p className="text-sm text-yellow-800 mb-2">
                    구매자 정보를 확인하려면 중개 수수료에 해당하는 포인트가 선차감됩니다.
                  </p>
                  <div className="text-sm text-yellow-700">
                    <p>• 필요 포인트: {Math.round(Number(report.commission)).toLocaleString()}p (중개 수수료 {Number(report.commission).toLocaleString()}원, VAT 별도)</p>
                    {pointsBalance !== null && (
                      <p>• 현재 잔액: {pointsBalance.toLocaleString()}p</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleRevealBuyerInfo}
                  disabled={pointsLoading}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {pointsLoading ? '처리 중...' : '구매자 정보 확인하기'}
                </button>
              </div>
            </div>
          )}

          {/* 구매자 정보 */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              구매자 정보
              {buyerInfoRevealed && report.points_deducted && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (포인트 {report.points_deducted.toLocaleString()}p 차감 완료)
                </span>
              )}
            </h3>
            {!buyerInfoRevealed ? (
              <div className="bg-gray-100 p-8 rounded-lg text-center">
                <p className="text-gray-500 text-lg">구매자 정보를 확인하려면 위의 버튼을 클릭하세요.</p>
              </div>
            ) : (
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
            )}
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
                    <span className="text-xs font-normal text-gray-500 ml-2">(VAT 별도)</span>
                  </span>
                </div>
                {report.points_deducted && report.points_deducted > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 pt-1">
                    <span className="ml-4">포인트 차감</span>
                    <span>
                      {report.points_deducted.toLocaleString()}p
                      <span className="text-xs text-gray-500 ml-1">(1원 = 1p)</span>
                    </span>
                  </div>
                )}
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
                  <p className="text-gray-900 font-semibold">{report.tracking_number}</p>
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

          {/* 안내 문구 */}
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>안내:</strong> 이 보고서를 확인한 후 구매자에게 약품을 발송해주세요. 
              배송이 완료되면 운송장 번호를 입력해주시기 바랍니다.
            </p>
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


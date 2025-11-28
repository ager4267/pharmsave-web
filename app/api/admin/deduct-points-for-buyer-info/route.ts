import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 구매자 정보 열람을 위한 포인트 차감 API
 * POST /api/admin/deduct-points-for-buyer-info
 * 
 * 구매자 정보를 노출하기 전에 포인트를 차감합니다.
 * 원자적 연산과 중복 방지가 포함되어 있습니다.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    if (!supabase || !supabase.auth) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
      return NextResponse.json(
        { success: false, error: '서버 설정 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { salesApprovalReportId } = body

    if (!salesApprovalReportId) {
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 판매 승인 보고서 조회
    const { data: report, error: reportError } = await supabase
      .from('sales_approval_reports')
      .select('id, seller_id, total_amount, commission, points_deducted, buyer_info_revealed')
      .eq('id', salesApprovalReportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 이미 포인트가 차감되었는지 확인
    if (report.points_deducted && report.points_deducted > 0) {
      return NextResponse.json({
        success: true,
        alreadyDeducted: true,
        message: '이미 포인트가 차감된 보고서입니다.',
        data: {
          pointsDeducted: report.points_deducted,
          balanceAfter: null // 이미 차감되었으므로 현재 잔액은 별도 조회 필요
        }
      })
    }

    // 판매자 정보 확인
    const { data: sellerProfile, error: sellerError } = await supabase
      .from('profiles')
      .select('id, company_name, email')
      .eq('id', report.seller_id)
      .single()

    if (sellerError || !sellerProfile) {
      return NextResponse.json(
        { success: false, error: '판매자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 중개 수수료를 포인트로 변환 (1원당 1p, VAT 별도)
    const commissionAmount = Number(report.commission)
    const pointsToDeduct = Math.round(commissionAmount)

    // 포인트 차감 함수 호출 (원자적 연산, 중복 방지 포함)
    const { data: result, error: deductError } = await supabase.rpc('deduct_points_for_buyer_info', {
      p_user_id: report.seller_id,
      p_amount: pointsToDeduct,
      p_sales_approval_report_id: salesApprovalReportId
    })

    if (deductError || !result || !result.success) {
      console.error('❌ 포인트 차감 실패:', deductError || result?.error)
      
      // 포인트 부족 오류 처리
      if (result?.code === 'INSUFFICIENT_POINTS') {
        return NextResponse.json(
          { 
            success: false, 
            error: '포인트가 부족합니다.',
            code: 'INSUFFICIENT_POINTS',
            balance: result.balance,
            required: result.required
          },
          { status: 400 }
        )
      }

      // 이미 차감된 경우
      if (result?.code === 'ALREADY_DEDUCTED') {
        return NextResponse.json({
          success: true,
          alreadyDeducted: true,
          message: result.error,
          data: {
            pointsDeducted: pointsToDeduct
          }
        })
      }

      return NextResponse.json(
        { 
          success: false, 
          error: result?.error || deductError?.message || '포인트 차감에 실패했습니다.' 
        },
        { status: 500 }
      )
    }

    console.log('✅ 포인트 차감 성공:', {
      salesApprovalReportId,
      sellerId: report.seller_id,
      companyName: sellerProfile.company_name,
      commissionAmount,
      pointsDeducted: pointsToDeduct,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
      transactionId: result.transaction_id
    })

    return NextResponse.json({
      success: true,
      data: {
        transactionId: result.transaction_id,
        salesApprovalReportId,
        sellerId: report.seller_id,
        companyName: sellerProfile.company_name,
        commissionAmount,
        pointsDeducted: pointsToDeduct,
        balanceBefore: result.balance_before,
        balanceAfter: result.balance_after
      }
    })
  } catch (error: any) {
    console.error('❌ 포인트 차감 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


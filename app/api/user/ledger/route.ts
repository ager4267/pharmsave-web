/**
 * 사용자용 원장 조회 API
 * GET /api/user/ledger
 * 
 * 사용자 자신의 입금 내역과 포인트 충전/사용 내역을 조회합니다.
 * - 입금 내역: point_charge_requests에서 승인된 항목
 * - 포인트 거래 내역: point_transactions에서 모든 거래 내역 (충전, 사용, 환불)
 */

import { createRouteHandlerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const response = new NextResponse()
    const supabase = createRouteHandlerClient(request, response)
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 사용자 인증 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 입금 내역 조회 (point_charge_requests에서 승인된 항목)
    let depositQuery = supabase
      .from('point_charge_requests')
      .select(`
        id,
        user_id,
        requested_amount,
        requested_points,
        status,
        description,
        admin_notes,
        created_at,
        reviewed_at,
        completed_at,
        admin:profiles!point_charge_requests_admin_user_id_fkey(company_name, email)
      `)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    if (startDate) {
      depositQuery = depositQuery.gte('created_at', startDate)
    }

    if (endDate) {
      depositQuery = depositQuery.lte('created_at', endDate)
    }

    const { data: deposits, error: depositsError } = await depositQuery

    if (depositsError) {
      console.error('❌ 입금 내역 조회 실패:', depositsError)
      return NextResponse.json(
        { success: false, error: '입금 내역 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 포인트 거래 내역 조회 (point_transactions에서 모든 거래 내역)
    let transactionsQuery = supabase
      .from('point_transactions')
      .select(`
        id,
        user_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        description,
        admin_user_id,
        created_at,
        admin:profiles!point_transactions_admin_user_id_fkey(company_name, email)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (startDate) {
      transactionsQuery = transactionsQuery.gte('created_at', startDate)
    }

    if (endDate) {
      transactionsQuery = transactionsQuery.lte('created_at', endDate)
    }

    const { data: transactions, error: transactionsError } = await transactionsQuery

    if (transactionsError) {
      console.error('❌ 포인트 거래 내역 조회 실패:', transactionsError)
      return NextResponse.json(
        { success: false, error: '포인트 거래 내역 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 통계 계산
    const totalDeposits = deposits?.reduce((sum, d) => sum + (d.requested_amount || 0), 0) || 0
    const totalDepositPoints = deposits?.reduce((sum, d) => sum + (d.requested_points || 0), 0) || 0
    
    // 충전과 사용 구분
    const chargeTransactions = transactions?.filter(t => t.transaction_type === 'charge') || []
    const deductTransactions = transactions?.filter(t => t.transaction_type === 'deduct') || []
    const refundTransactions = transactions?.filter(t => t.transaction_type === 'refund') || []
    
    const totalChargePoints = chargeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    const totalDeductPoints = deductTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    const totalRefundPoints = refundTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    
    const depositCount = deposits?.length || 0
    const transactionCount = transactions?.length || 0
    const chargeCount = chargeTransactions.length
    const deductCount = deductTransactions.length
    const refundCount = refundTransactions.length

    console.log('✅ 원장 조회 성공:', {
      userId: user.id,
      depositCount,
      transactionCount,
      chargeCount,
      deductCount,
      refundCount,
      totalDeposits,
      totalDepositPoints,
      totalChargePoints,
      totalDeductPoints,
      totalRefundPoints,
    })

    return NextResponse.json({
      success: true,
      data: {
        deposits: deposits || [],
        transactions: transactions || [],
        statistics: {
          totalDeposits,
          totalDepositPoints,
          totalChargePoints,
          totalDeductPoints,
          totalRefundPoints,
          depositCount,
          transactionCount,
          chargeCount,
          deductCount,
          refundCount,
        },
      },
    })
  } catch (error: any) {
    console.error('❌ 원장 조회 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '원장 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


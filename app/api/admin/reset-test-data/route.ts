import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 테스트 데이터 초기화 API
 * 관리자만 접근 가능하며, 관리자를 제외한 모든 사용자 데이터를 삭제합니다.
 * 
 * 주의: 이 API는 프로덕션 환경에서 사용하면 안 됩니다!
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = await createClient()
    
    if (!supabase || !supabase.auth) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
      return NextResponse.json(
        { success: false, error: '서버 설정 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 2. 관리자 권한 확인
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    // 3. 환경 확인 (프로덕션 환경에서는 실행 방지)
    const isProduction = process.env.NODE_ENV === 'production'
    const allowReset = process.env.ALLOW_TEST_DATA_RESET === 'true'

    if (isProduction && !allowReset) {
      return NextResponse.json(
        { 
          success: false, 
          error: '프로덕션 환경에서는 데이터 초기화가 비활성화되어 있습니다.' 
        },
        { status: 403 }
      )
    }

    // 4. Service Role 클라이언트 생성 (RLS 우회)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: '서버 설정 오류: Service Role Key가 없습니다.' },
        { status: 500 }
      )
    }

    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json(
        { success: false, error: '서버 설정 오류: Supabase URL이 없습니다.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, serviceRoleKey)

    // 5. 관리자 ID 목록 조회
    const { data: adminProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    const adminIds = adminProfiles?.map(p => p.id) || []

    if (adminIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '관리자 계정을 찾을 수 없습니다. 초기화를 중단합니다.' },
        { status: 400 }
      )
    }

    // 6. 데이터 삭제 (외래키 제약조건을 고려한 역순)
    const deletionResults: Record<string, number> = {}

    try {
      // 관리자가 아닌 사용자 ID 목록 조회
      const { data: nonAdminProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .neq('role', 'admin')

      const nonAdminIds = nonAdminProfiles?.map(p => p.id) || []

      if (nonAdminIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: '삭제할 데이터가 없습니다.',
          deletionResults: {},
          totalDeleted: 0,
          adminCount: adminIds.length,
          timestamp: new Date().toISOString()
        })
      }

      // 6-1. 포인트 충전 요청
      const { count: chargeRequestsCount } = await supabaseAdmin
        .from('point_charge_requests')
        .delete()
        .in('user_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.point_charge_requests = chargeRequestsCount || 0

      // 6-2. 포인트 거래 내역
      const { count: transactionsCount } = await supabaseAdmin
        .from('point_transactions')
        .delete()
        .in('user_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.point_transactions = transactionsCount || 0

      // 6-3. 포인트 잔액
      const { count: pointsCount } = await supabaseAdmin
        .from('points')
        .delete()
        .in('user_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.points = pointsCount || 0

      // 6-4. 판매 승인 보고서 (seller_id 또는 buyer_id가 관리자가 아닌 경우)
      // 먼저 seller_id가 관리자가 아닌 경우 삭제
      const { count: reportsCount1 } = await supabaseAdmin
        .from('sales_approval_reports')
        .delete()
        .in('seller_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      
      // buyer_id가 관리자가 아닌 경우 삭제 (seller_id는 관리자지만 buyer_id는 아닌 경우)
      const { count: reportsCount2 } = await supabaseAdmin
        .from('sales_approval_reports')
        .delete()
        .in('buyer_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      
      deletionResults.sales_approval_reports = (reportsCount1 || 0) + (reportsCount2 || 0)

      // 6-5. 재판매
      const { count: resalesCount } = await supabaseAdmin
        .from('resales')
        .delete()
        .in('buyer_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.resales = resalesCount || 0

      // 6-6. 결제 (관련 purchase_request 또는 purchase_order가 관리자와 관련 없는 경우)
      // 먼저 관련 purchase_request와 purchase_order ID 조회
      const { data: nonAdminPurchaseRequests } = await supabaseAdmin
        .from('purchase_requests')
        .select('id')
        .in('buyer_id', nonAdminIds)

      const { data: nonAdminPurchaseOrders } = await supabaseAdmin
        .from('purchase_orders')
        .select('id')
        .in('seller_id', nonAdminIds)

      const nonAdminPrIds = nonAdminPurchaseRequests?.map(pr => pr.id) || []
      const nonAdminPoIds = nonAdminPurchaseOrders?.map(po => po.id) || []

      if (nonAdminPrIds.length > 0 || nonAdminPoIds.length > 0) {
        let paymentsQuery = supabaseAdmin
          .from('payments')
          .delete()
        
        if (nonAdminPrIds.length > 0 && nonAdminPoIds.length > 0) {
          paymentsQuery = paymentsQuery.or(`purchase_request_id.in.(${nonAdminPrIds.join(',')}),purchase_order_id.in.(${nonAdminPoIds.join(',')})`)
        } else if (nonAdminPrIds.length > 0) {
          paymentsQuery = paymentsQuery.in('purchase_request_id', nonAdminPrIds)
        } else {
          paymentsQuery = paymentsQuery.in('purchase_order_id', nonAdminPoIds)
        }
        
        const { count: paymentsCount } = await paymentsQuery
          .select('*', { count: 'exact', head: true })
        deletionResults.payments = paymentsCount || 0
      } else {
        deletionResults.payments = 0
      }

      // 6-7. 매입 요청
      const { count: purchaseOrdersCount } = await supabaseAdmin
        .from('purchase_orders')
        .delete()
        .in('seller_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.purchase_orders = purchaseOrdersCount || 0

      // 6-8. 구매 요청
      const { count: purchaseRequestsCount } = await supabaseAdmin
        .from('purchase_requests')
        .delete()
        .in('buyer_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.purchase_requests = purchaseRequestsCount || 0

      // 6-9. 상품
      const { count: productsCount } = await supabaseAdmin
        .from('products')
        .delete()
        .in('seller_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.products = productsCount || 0

      // 6-10. 판매 리스트
      const { count: salesListsCount } = await supabaseAdmin
        .from('sales_lists')
        .delete()
        .in('seller_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.sales_lists = salesListsCount || 0

      // 6-11. 재고 분석
      const { count: analysesCount } = await supabaseAdmin
        .from('inventory_analyses')
        .delete()
        .in('user_id', nonAdminIds)
        .select('*', { count: 'exact', head: true })
      deletionResults.inventory_analyses = analysesCount || 0

      // 6-12. 사용자 프로필 (관리자 제외)
      const { count: profilesCount } = await supabaseAdmin
        .from('profiles')
        .delete()
        .neq('role', 'admin')
        .select('*', { count: 'exact', head: true })
      deletionResults.profiles = profilesCount || 0

    } catch (deleteError: any) {
      console.error('데이터 삭제 중 오류:', deleteError)
      return NextResponse.json(
        { 
          success: false, 
          error: `데이터 삭제 중 오류가 발생했습니다: ${deleteError.message}`,
          partialResults: deletionResults
        },
        { status: 500 }
      )
    }

    // 7. 결과 반환
    const totalDeleted = Object.values(deletionResults).reduce((sum, count) => sum + count, 0)

    return NextResponse.json({
      success: true,
      message: '테스트 데이터 초기화가 완료되었습니다.',
      deletionResults,
      totalDeleted,
      adminCount: adminIds.length,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('데이터 초기화 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '알 수 없는 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


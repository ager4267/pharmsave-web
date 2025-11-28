import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, adminUserId } = await request.json()

    if (!userId || !adminUserId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID와 관리자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // Service Role 클라이언트 생성 (RLS 정책 우회)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 관리자 권한 확인
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    // 자기 자신 삭제 방지
    if (userId === adminUserId) {
      return NextResponse.json(
        { success: false, error: '자기 자신은 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 삭제할 사용자 확인
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single()

    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 다른 관리자 삭제 방지
    if (userProfile.role === 'admin') {
      return NextResponse.json(
        { success: false, error: '다른 관리자는 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 1. 관련 데이터 먼저 삭제 (외래키 제약조건 해결)
    console.log('관련 데이터 삭제 시작...')
    
    // 1-1. points 관련 데이터 삭제
    const { error: pointsDeleteError } = await supabase
      .from('points')
      .delete()
      .eq('user_id', userId)
    
    if (pointsDeleteError) {
      console.error('포인트 삭제 오류:', pointsDeleteError)
    } else {
      console.log('✅ 포인트 삭제 완료')
    }

    // 1-2. point_transactions 삭제
    const { error: pointTransactionsDeleteError } = await supabase
      .from('point_transactions')
      .delete()
      .or(`user_id.eq.${userId},admin_user_id.eq.${userId}`)
    
    if (pointTransactionsDeleteError) {
      console.error('포인트 거래 내역 삭제 오류:', pointTransactionsDeleteError)
    } else {
      console.log('✅ 포인트 거래 내역 삭제 완료')
    }

    // 1-3. point_charge_requests 삭제
    const { error: pointChargeRequestsDeleteError } = await supabase
      .from('point_charge_requests')
      .delete()
      .or(`user_id.eq.${userId},admin_user_id.eq.${userId}`)
    
    if (pointChargeRequestsDeleteError) {
      console.error('포인트 충전 요청 삭제 오류:', pointChargeRequestsDeleteError)
    } else {
      console.log('✅ 포인트 충전 요청 삭제 완료')
    }

    // 1-4. inventory_analyses 삭제
    const { error: inventoryAnalysesDeleteError } = await supabase
      .from('inventory_analyses')
      .delete()
      .eq('user_id', userId)
    
    if (inventoryAnalysesDeleteError) {
      console.error('재고 분석 삭제 오류:', inventoryAnalysesDeleteError)
    } else {
      console.log('✅ 재고 분석 삭제 완료')
    }

    // 1-5. products 삭제 (판매자가 등록한 상품)
    const { error: productsDeleteError } = await supabase
      .from('products')
      .delete()
      .eq('seller_id', userId)
    
    if (productsDeleteError) {
      console.error('상품 삭제 오류:', productsDeleteError)
    } else {
      console.log('✅ 상품 삭제 완료')
    }

    // 1-6. purchase_orders 삭제
    const { error: purchaseOrdersDeleteError } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('seller_id', userId)
    
    if (purchaseOrdersDeleteError) {
      console.error('구매 주문 삭제 오류:', purchaseOrdersDeleteError)
    } else {
      console.log('✅ 구매 주문 삭제 완료')
    }

    // 1-7. purchase_requests 삭제
    const { error: purchaseRequestsDeleteError } = await supabase
      .from('purchase_requests')
      .delete()
      .or(`buyer_id.eq.${userId},reviewed_by.eq.${userId}`)
    
    if (purchaseRequestsDeleteError) {
      console.error('구매 요청 삭제 오류:', purchaseRequestsDeleteError)
    } else {
      console.log('✅ 구매 요청 삭제 완료')
    }

    // 1-8. resales 삭제
    const { error: resalesDeleteError } = await supabase
      .from('resales')
      .delete()
      .eq('buyer_id', userId)
    
    if (resalesDeleteError) {
      console.error('재판매 삭제 오류:', resalesDeleteError)
    } else {
      console.log('✅ 재판매 삭제 완료')
    }

    // 1-9. sales_approval_reports 삭제
    const { error: salesApprovalReportsDeleteError } = await supabase
      .from('sales_approval_reports')
      .delete()
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    
    if (salesApprovalReportsDeleteError) {
      console.error('판매 승인 보고서 삭제 오류:', salesApprovalReportsDeleteError)
    } else {
      console.log('✅ 판매 승인 보고서 삭제 완료')
    }

    // 1-10. sales_lists 삭제
    const { error: salesListsDeleteError } = await supabase
      .from('sales_lists')
      .delete()
      .or(`seller_id.eq.${userId},reviewed_by.eq.${userId}`)
    
    if (salesListsDeleteError) {
      console.error('판매 리스트 삭제 오류:', salesListsDeleteError)
    } else {
      console.log('✅ 판매 리스트 삭제 완료')
    }

    console.log('관련 데이터 삭제 완료, 프로필 삭제 시작...')

    // 2. profiles 테이블에서 삭제
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      console.error('프로필 삭제 오류:', profileDeleteError)
      return NextResponse.json(
        { success: false, error: `프로필 삭제 실패: ${profileDeleteError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 프로필 삭제 완료')

    // 2. auth.users에서 삭제 (Admin API 사용)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('인증 사용자 삭제 오류:', authDeleteError)
      // 프로필은 삭제되었지만 auth.users 삭제 실패
      return NextResponse.json({
        success: true,
        warning: '프로필은 삭제되었지만 인증 정보 삭제에 실패했습니다.',
        message: '사용자 프로필이 삭제되었습니다.',
      })
    }

    console.log('✅ 사용자 삭제 성공:', userId)

    return NextResponse.json({
      success: true,
      message: '사용자가 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


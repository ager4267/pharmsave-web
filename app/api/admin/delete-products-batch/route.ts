import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { productIds, adminUserId } = await request.json()

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 상품 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!adminUserId) {
      return NextResponse.json(
        { success: false, error: '관리자 ID가 필요합니다.' },
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

    // 구매 요청 확인
    const { data: purchaseRequests, error: purchaseRequestsError } = await supabase
      .from('purchase_requests')
      .select('id, product_id, status')
      .in('product_id', productIds)

    if (purchaseRequestsError) {
      console.error('구매 요청 조회 오류:', purchaseRequestsError)
    }

    // 승인된 구매 요청이 있는 상품 ID 추출
    const approvedRequests = purchaseRequests?.filter((req: any) => req.status === 'approved') || []
    const productsWithApprovedRequests = new Set(
      approvedRequests.map((req: any) => req.product_id)
    )

    // 승인된 구매 요청이 없는 상품만 필터링
    const deletableProductIds = productIds.filter((id: string) => !productsWithApprovedRequests.has(id))

    if (deletableProductIds.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '선택한 모든 상품에 승인된 구매 요청이 있어 삭제할 수 없습니다.' 
        },
        { status: 400 }
      )
    }

    // 진행 중인 구매 요청(pending, confirmed) 취소 처리
    const activeRequests = purchaseRequests?.filter((req: any) => 
      (req.status === 'pending' || req.status === 'confirmed') && 
      deletableProductIds.includes(req.product_id)
    ) || []

    if (activeRequests.length > 0) {
      const requestIds = activeRequests.map((req: any) => req.id)
      const { error: cancelError } = await supabase
        .from('purchase_requests')
        .update({ status: 'cancelled' })
        .in('id', requestIds)

      if (cancelError) {
        console.error('구매 요청 취소 오류:', cancelError)
        return NextResponse.json(
          { success: false, error: `구매 요청 취소 실패: ${cancelError.message}` },
          { status: 500 }
        )
      }

      console.log(`✅ ${activeRequests.length}개의 구매 요청이 취소되었습니다.`)
    }

    // 일괄 삭제
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .in('id', deletableProductIds)

    if (deleteError) {
      console.error('상품 일괄 삭제 오류:', deleteError)
      return NextResponse.json(
        { success: false, error: `상품 삭제 실패: ${deleteError.message}` },
        { status: 500 }
      )
    }

    const deletedCount = deletableProductIds.length
    const skippedCount = productIds.length - deletedCount
    const cancelledRequestsCount = activeRequests.length

    console.log('✅ 상품 일괄 삭제 성공:', { deletedCount, skippedCount, cancelledRequestsCount })

    return NextResponse.json({
      success: true,
      message: `${deletedCount}개의 상품이 삭제되었습니다.${cancelledRequestsCount > 0 ? ` (${cancelledRequestsCount}개의 구매 요청이 자동 취소됨)` : ''}${skippedCount > 0 ? ` (${skippedCount}개는 승인된 구매 요청이 있어 건너뜀)` : ''}`,
      deletedCount,
      skippedCount,
      cancelledRequestsCount,
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


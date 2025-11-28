import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { productId, adminUserId } = await request.json()

    if (!productId || !adminUserId) {
      return NextResponse.json(
        { success: false, error: '상품 ID와 관리자 ID가 필요합니다.' },
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

    // 상품 확인
    const { data: product } = await supabase
      .from('products')
      .select('id, product_name, status')
      .eq('id', productId)
      .single()

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 구매 요청이 있는지 확인
    const { data: purchaseRequests, error: purchaseRequestsError } = await supabase
      .from('purchase_requests')
      .select('id, status')
      .eq('product_id', productId)

    if (purchaseRequestsError) {
      console.error('구매 요청 조회 오류:', purchaseRequestsError)
    }

    // 승인된 구매 요청이 있는 경우 삭제 불가
    const approvedRequests = purchaseRequests?.filter((req: any) => req.status === 'approved') || []
    if (approvedRequests.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `이 상품에는 승인된 구매 요청이 ${approvedRequests.length}개 있어 삭제할 수 없습니다.` 
        },
        { status: 400 }
      )
    }

    // 진행 중인 구매 요청(pending, confirmed) 취소 처리
    const activeRequests = purchaseRequests?.filter((req: any) => 
      req.status === 'pending' || req.status === 'confirmed'
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

    // 상품 삭제
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (deleteError) {
      console.error('상품 삭제 오류:', deleteError)
      return NextResponse.json(
        { success: false, error: `상품 삭제 실패: ${deleteError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 상품 삭제 성공:', productId)

    return NextResponse.json({
      success: true,
      message: '상품이 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


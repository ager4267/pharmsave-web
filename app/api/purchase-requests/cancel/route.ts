import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { purchaseRequestId, userId } = await request.json()

    if (!purchaseRequestId || !userId) {
      return NextResponse.json(
        { success: false, error: '구매 요청 ID와 사용자 ID가 필요합니다.' },
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

    // 구매 요청 조회 및 소유자 확인
    const { data: purchaseRequest, error: fetchError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('id', purchaseRequestId)
      .single()

    if (fetchError || !purchaseRequest) {
      return NextResponse.json(
        { success: false, error: '구매 요청을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 소유자 확인
    if (purchaseRequest.buyer_id !== userId) {
      return NextResponse.json(
        { success: false, error: '본인의 구매 요청만 취소할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 이미 승인되었거나 취소된 경우
    if (purchaseRequest.status === 'approved' || purchaseRequest.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: `이미 ${purchaseRequest.status === 'approved' ? '승인된' : '취소된'} 구매 요청입니다.` },
        { status: 400 }
      )
    }

    // 구매 요청 취소
    const { data: updatedRequest, error: updateError } = await supabase
      .from('purchase_requests')
      .update({
        status: 'cancelled',
      })
      .eq('id', purchaseRequestId)
      .select()
      .single()

    if (updateError) {
      console.error('구매 요청 취소 오류:', updateError)
      return NextResponse.json(
        { success: false, error: `구매 요청 취소에 실패했습니다: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 구매 요청 취소 성공:', purchaseRequestId)

    return NextResponse.json({
      success: true,
      purchaseRequest: updatedRequest,
      message: '구매 요청이 취소되었습니다.',
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


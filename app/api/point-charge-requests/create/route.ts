import { NextRequest, NextResponse } from 'next/server'

/**
 * 포인트 충전 요청 생성 API
 * POST /api/point-charge-requests/create
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, amount, description } = body

    // userId 검증
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 입력 검증
    if (!amount) {
      return NextResponse.json(
        { success: false, error: '충전 금액이 필요합니다.' },
        { status: 400 }
      )
    }

    const chargeAmount = parseInt(amount)
    if (isNaN(chargeAmount) || chargeAmount <= 0) {
      return NextResponse.json(
        { success: false, error: '충전 금액은 0보다 큰 정수여야 합니다.' },
        { status: 400 }
      )
    }

    // 포인트는 1원당 1p
    const pointsToCharge = chargeAmount

    // Service Role 클라이언트 생성 (RLS 정책 우회)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ 환경 변수 확인:', {
        supabaseUrl: supabaseUrl ? '설정됨' : '없음',
        supabaseServiceRoleKey: supabaseServiceRoleKey ? '설정됨' : '없음'
      })
      return NextResponse.json(
        { 
          success: false, 
          error: '환경 변수가 설정되지 않았습니다.',
          details: 'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.'
        },
        { status: 500 }
      )
    }

    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 포인트 충전 요청 생성
    const { data: chargeRequest, error: requestError } = await supabase
      .from('point_charge_requests')
      .insert({
        user_id: userId,
        requested_amount: chargeAmount,
        requested_points: pointsToCharge,
        description: description || `포인트 충전 요청: ${chargeAmount.toLocaleString()}원 = ${pointsToCharge.toLocaleString()}p`,
        status: 'pending'
      })
      .select()
      .single()

    if (requestError) {
      console.error('❌ 포인트 충전 요청 생성 실패:', {
        error: requestError,
        code: requestError.code,
        message: requestError.message,
        details: requestError.details,
        hint: requestError.hint,
        userId,
        chargeAmount,
        pointsToCharge
      })
      return NextResponse.json(
        { 
          success: false, 
          error: '포인트 충전 요청 생성에 실패했습니다.',
          details: requestError.message || requestError.code || '알 수 없는 오류',
          hint: requestError.hint || null
        },
        { status: 500 }
      )
    }

    console.log('✅ 포인트 충전 요청 생성 성공:', {
      requestId: chargeRequest.id,
      userId: userId,
      amount: chargeAmount,
      points: pointsToCharge
    })

    return NextResponse.json({
      success: true,
      data: {
        requestId: chargeRequest.id,
        amount: chargeAmount,
        points: pointsToCharge,
        status: chargeRequest.status
      }
    })
  } catch (error: any) {
    console.error('❌ 포인트 충전 요청 생성 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


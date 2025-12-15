import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'

// 동적 렌더링 강제 (request.cookies 사용으로 인해 필요)
export const dynamic = 'force-dynamic'

/**
 * 관리자 포인트 충전 API
 * POST /api/admin/charge-points
 */
export async function POST(request: NextRequest) {
  let response = new NextResponse()
  
  try {
    // 쿠키 확인 (디버깅용)
    const cookieHeader = request.headers.get('cookie')
    console.log('📋 요청 쿠키:', cookieHeader ? '있음' : '없음')
    
    // 쿠키 내용 확인
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim())
      const supabaseCookies = cookies.filter(c => 
        c.includes('sb-') || c.includes('supabase')
      )
      console.log('🍪 Supabase 쿠키:', supabaseCookies.length > 0 ? supabaseCookies : '없음')
    }
    
    const supabase = createRouteHandlerClient(request, response)
    
    if (!supabase || !supabase.auth) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
      return NextResponse.json(
        { success: false, error: '서버 설정 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    // 인증 확인 (getSession 대신 getUser 직접 사용)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // 디버깅: 세션도 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('🔐 세션 확인:', session ? `세션 있음 (${session.user.email})` : '세션 없음')
    if (sessionError) {
      console.error('❌ 세션 오류:', sessionError)
    }
    
    if (authError) {
      console.error('❌ 인증 오류:', authError)
      console.error('인증 오류 상세:', {
        message: authError.message,
        status: authError.status,
        name: authError.name
      })
      return NextResponse.json(
        { 
          success: false, 
          error: '인증이 필요합니다.',
          details: authError.message 
        },
        { status: 401 }
      )
    }
    
    if (!user) {
      console.error('❌ 사용자가 없습니다.')
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
    
    console.log('✅ 인증된 사용자:', { id: user.id, email: user.email })

    // 관리자 권한 확인
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

    const body = await request.json()
    const { userId, amount, description } = body

    // 입력 검증
    if (!userId || !amount) {
      return NextResponse.json(
        { success: false, error: '사용자 ID와 충전 금액이 필요합니다.' },
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

    // 사용자 존재 확인
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id, company_name, email')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 포인트 충전 함수 호출 (원자적 연산)
    const { data: result, error: chargeError } = await supabase.rpc('charge_points', {
      p_user_id: userId,
      p_amount: pointsToCharge,
      p_admin_user_id: user.id,
      p_description: description || `관리자 포인트 충전 (${chargeAmount.toLocaleString()}원 = ${pointsToCharge.toLocaleString()}p)`
    })

    if (chargeError || !result || !result.success) {
      console.error('❌ 포인트 충전 실패:', chargeError || result?.error)
      return NextResponse.json(
        { 
          success: false, 
          error: result?.error || chargeError?.message || '포인트 충전에 실패했습니다.' 
        },
        { status: 500 }
      )
    }

    console.log('✅ 포인트 충전 성공:', {
      userId,
      companyName: targetUser.company_name,
      amount: chargeAmount,
      points: pointsToCharge,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
      transactionId: result.transaction_id
    })

    // 쿠키를 응답에 포함
    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        transactionId: result.transaction_id,
        userId,
        companyName: targetUser.company_name,
        amount: chargeAmount,
        points: pointsToCharge,
        balanceBefore: result.balance_before,
        balanceAfter: result.balance_after
      }
    })
    
    // response의 쿠키를 jsonResponse에 복사
    response.cookies.getAll().forEach(cookie => {
      jsonResponse.cookies.set(cookie.name, cookie.value)
    })
    
    return jsonResponse
  } catch (error: any) {
    console.error('❌ 포인트 충전 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


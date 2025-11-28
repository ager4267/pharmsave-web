import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'

/**
 * 포인트 조회 API
 * POST /api/admin/get-points
 */
export async function POST(request: NextRequest) {
  const response = new NextResponse()
  
  try {
    const supabase = createRouteHandlerClient(request, response)
    
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
    const { userId } = body

    // userId가 제공되지 않으면 현재 사용자의 포인트 조회
    const targetUserId = userId || user.id

    // 포인트 조회
    const { data: points, error: pointsError } = await supabase
      .from('points')
      .select('*')
      .eq('user_id', targetUserId)
      .single()

    if (pointsError && pointsError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('❌ 포인트 조회 오류:', pointsError)
      return NextResponse.json(
        { success: false, error: '포인트 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 포인트 레코드가 없으면 0으로 생성
    const balance = points?.balance || 0

    // 포인트 레코드가 없으면 생성
    if (!points) {
      const { error: insertError } = await supabase
        .from('points')
        .insert({
          user_id: targetUserId,
          balance: 0
        })

      if (insertError) {
        console.error('❌ 포인트 레코드 생성 오류:', insertError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: targetUserId,
        balance,
        points: balance // 1원당 1p
      }
    })
  } catch (error: any) {
    console.error('❌ 포인트 조회 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


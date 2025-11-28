import { NextRequest, NextResponse } from 'next/server'

/**
 * 내 포인트 충전 요청 조회 API
 * GET /api/point-charge-requests/my-requests?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // Service Role 클라이언트 생성 (RLS 정책 우회)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 내 포인트 충전 요청 조회
    const { data: requests, error: requestsError } = await supabase
      .from('point_charge_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (requestsError) {
      console.error('❌ 포인트 충전 요청 조회 실패:', requestsError)
      return NextResponse.json(
        { success: false, error: '포인트 충전 요청 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: requests || []
    })
  } catch (error: any) {
    console.error('❌ 포인트 충전 요청 조회 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


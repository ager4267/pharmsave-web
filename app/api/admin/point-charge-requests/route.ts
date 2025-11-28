import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 관리자 포인트 충전 요청 조회 API
 * GET /api/admin/point-charge-requests
 */
export async function GET(request: NextRequest) {
  try {
    // Service Role 클라이언트 생성 (RLS 정책 우회)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 상태 필터링 (쿼리 파라미터)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('point_charge_requests')
      .select(`
        *,
        user:profiles!point_charge_requests_user_id_fkey(company_name, email, phone_number),
        admin:profiles!point_charge_requests_admin_user_id_fkey(company_name, email)
      `)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: requests, error: requestsError } = await query

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


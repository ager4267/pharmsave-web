import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 모든 사용자 목록 조회 API (서버 사이드)
 * Service Role 키를 사용하여 RLS 정책 우회
 * GET /api/admin/get-all-users?status=pending|approved|rejected
 */
export async function GET(request: Request) {
  try {
    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: '환경 변수가 설정되지 않았습니다.' },
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

    // 쿼리 파라미터에서 필터 확인
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // 사용자 조회
    let query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('license_verification_status', status)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('사용자 조회 오류:', error)
      return NextResponse.json(
        { error: `사용자 조회 실패: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      users: users || [],
      count: users?.length || 0,
    })
  } catch (error: any) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


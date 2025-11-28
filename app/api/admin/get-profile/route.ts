import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 프로필 조회 API (서버 사이드)
 * Service Role 키를 사용하여 RLS 정책 우회
 * POST /api/admin/get-profile
 * 
 * 요청 본문:
 * {
 *   "userId": "user-uuid"
 * }
 */
export async function POST(request: Request) {
  try {
    console.log('📥 API 요청 수신: /api/admin/get-profile')
    
    const { userId } = await request.json()
    console.log('📋 요청 데이터:', { userId })

    // 필수 필드 확인
    if (!userId) {
      console.error('❌ userId가 없습니다.')
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ 환경 변수가 설정되지 않았습니다.')
      console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '설정됨' : '없음')
      console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '설정됨' : '없음')
      return NextResponse.json(
        { error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    console.log('✅ 환경 변수 확인 완료')

    // Service Role 클라이언트 생성 (RLS 정책 우회)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🔍 프로필 조회 시도...')
    // 프로필 조회
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('❌ 프로필 조회 오류:', error)
      return NextResponse.json(
        { error: `프로필 조회 실패: ${error.message}` },
        { status: 500 }
      )
    }

    if (!profile) {
      console.error('❌ 프로필을 찾을 수 없습니다. userId:', userId)
      return NextResponse.json(
        { error: '프로필을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.log('✅ 프로필 조회 성공:', profile.email, profile.role)

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error: any) {
    console.error('❌ API 오류:', error)
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


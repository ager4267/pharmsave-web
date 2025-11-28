import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, adminUserId } = await request.json()

    if (!userId || !adminUserId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID와 관리자 ID가 필요합니다.' },
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

    // 자기 자신 삭제 방지
    if (userId === adminUserId) {
      return NextResponse.json(
        { success: false, error: '자기 자신은 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 삭제할 사용자 확인
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single()

    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 다른 관리자 삭제 방지
    if (userProfile.role === 'admin') {
      return NextResponse.json(
        { success: false, error: '다른 관리자는 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 1. profiles 테이블에서 삭제
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      console.error('프로필 삭제 오류:', profileDeleteError)
      return NextResponse.json(
        { success: false, error: `프로필 삭제 실패: ${profileDeleteError.message}` },
        { status: 500 }
      )
    }

    // 2. auth.users에서 삭제 (Admin API 사용)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('인증 사용자 삭제 오류:', authDeleteError)
      // 프로필은 삭제되었지만 auth.users 삭제 실패
      return NextResponse.json({
        success: true,
        warning: '프로필은 삭제되었지만 인증 정보 삭제에 실패했습니다.',
        message: '사용자 프로필이 삭제되었습니다.',
      })
    }

    console.log('✅ 사용자 삭제 성공:', userId)

    return NextResponse.json({
      success: true,
      message: '사용자가 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


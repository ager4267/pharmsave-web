import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 관리자 비밀번호 재설정 API
 * POST /api/admin/reset-password
 * 
 * 요청 본문:
 * {
 *   "email": "admin@example.com",
 *   "password": "new_password"
 * }
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // 필수 필드 확인
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호가 필요합니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 길이 확인 (최소 6자)
    if (password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // Service Role 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 사용자 찾기
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()

    if (userError) {
      console.error('사용자 조회 오류:', userError)
      return NextResponse.json(
        { error: `사용자 조회 실패: ${userError.message}` },
        { status: 500 }
      )
    }

    const user = users?.users.find(u => u.email === email)

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 비밀번호 업데이트
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password }
    )

    if (updateError) {
      console.error('비밀번호 업데이트 오류:', updateError)
      return NextResponse.json(
        { error: `비밀번호 업데이트 실패: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 비밀번호 변경 성공:', email)

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
      email,
    })
  } catch (error: any) {
    console.error('비밀번호 변경 중 오류:', error)
    return NextResponse.json(
      { error: error.message || '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


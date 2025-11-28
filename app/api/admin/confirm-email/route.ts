import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 이메일 확인 처리 API (서버 사이드)
 * Service Role 키를 사용하여 이메일 확인 처리
 * POST /api/admin/confirm-email
 * 
 * 요청 본문:
 * {
 *   "userId": "user-uuid"
 * }
 * 또는
 * {
 *   "email": "user@example.com"
 * }
 */
export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json()

    // 필수 필드 확인
    if (!userId && !email) {
      return NextResponse.json(
        { error: 'userId 또는 email이 필요합니다.' },
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

    // Service Role 클라이언트 생성 (관리자 권한)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    let targetUserId = userId

    // 이메일로 사용자 ID 찾기
    if (!targetUserId && email) {
      const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()

      if (usersError) {
        console.error('사용자 조회 오류:', usersError)
        return NextResponse.json(
          { error: `사용자 조회 실패: ${usersError.message}` },
          { status: 500 }
        )
      }

      const user = usersData.users.find(u => u.email === email)

      if (!user) {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      targetUserId = user.id
    }

    // 이메일 확인 처리
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { email_confirm: true }
    )

    if (updateError) {
      console.error('이메일 확인 처리 오류:', updateError)
      return NextResponse.json(
        { error: `이메일 확인 처리 실패: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 이메일 확인 처리 성공:', updateData)

    return NextResponse.json({
      success: true,
      message: '이메일 확인 처리가 완료되었습니다.',
      user: {
        id: targetUserId,
        email: updateData.user.email,
      },
    })
  } catch (error: any) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


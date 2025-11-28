import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 관리자 계정 생성 API
 * POST /api/admin/create-admin
 * 
 * 요청 본문:
 * {
 *   "email": "admin@example.com",
 *   "password": "secure_password",
 *   "company_name": "관리자 회사",
 *   "business_number": "000-00-00000"
 * }
 */
export async function POST(request: Request) {
  try {
    const { email, password, company_name, business_number } = await request.json()

    // 필수 필드 확인
    if (!email || !password || !company_name || !business_number) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다. (email, password, company_name, business_number)' },
        { status: 400 }
      )
    }

    // 이메일 형식 확인
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '유효하지 않은 이메일 형식입니다.' },
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
        { error: '환경 변수가 설정되지 않았습니다. (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' },
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

    // 1. 사용자 계정 생성
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      console.error('관리자 계정 생성 오류:', signUpError)
      return NextResponse.json(
        { error: `계정 생성 실패: ${signUpError.message}` },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: '사용자 계정이 생성되지 않았습니다.' },
        { status: 500 }
      )
    }

    const userId = authData.user.id
    console.log('✅ 관리자 계정 생성 성공:', userId)

    // 2. 이메일 확인 처리 (Service Role로 이메일 확인)
    try {
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { email_confirm: true }
      )

      if (updateError) {
        console.error('이메일 확인 처리 오류:', updateError)
        // 이메일 확인 실패해도 계속 진행 (수동으로 처리 가능)
      } else {
        console.log('✅ 이메일 확인 처리 성공:', updateData)
      }
    } catch (emailConfirmError) {
      console.error('이메일 확인 처리 중 오류:', emailConfirmError)
      // 이메일 확인 실패해도 계속 진행
    }

    // 3. 프로필이 트리거로 생성될 때까지 대기 (최대 5초)
    let profileExists = false
    for (let i = 0; i < 50; i++) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (profile) {
        profileExists = true
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 4. 프로필이 없으면 직접 생성
    if (!profileExists) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          company_name,
          business_number,
          role: 'admin',
          license_verification_status: 'approved',
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error('프로필 생성 오류:', profileError)
        return NextResponse.json(
          { error: `프로필 생성 실패: ${profileError.message}` },
          { status: 500 }
        )
      }
    } else {
      // 5. 프로필이 있으면 관리자 역할로 업데이트
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: 'admin',
          license_verification_status: 'approved',
          company_name,
          business_number,
        })
        .eq('id', userId)

      if (updateError) {
        console.error('프로필 업데이트 오류:', updateError)
        return NextResponse.json(
          { error: `프로필 업데이트 실패: ${updateError.message}` },
          { status: 500 }
        )
      }
    }

    console.log('✅ 관리자 프로필 생성/업데이트 성공')

    return NextResponse.json({
      success: true,
      message: '관리자 계정이 성공적으로 생성되었습니다.',
      user: {
        id: userId,
        email,
        role: 'admin',
      },
    })
  } catch (error: any) {
    console.error('관리자 계정 생성 중 오류:', error)
    return NextResponse.json(
      { error: error.message || '관리자 계정 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


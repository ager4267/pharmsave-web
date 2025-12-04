import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 프로필 생성 API (서버 사이드)
 * Service Role 키를 사용하여 프로필 생성
 * 트리거가 작동하지 않을 때 사용
 * 
 * 사용 방법:
 * POST /api/admin/create-profile
 * Body: { userId: string, email: string, companyName: string, businessNumber: string }
 */

export async function POST(request: NextRequest) {
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

    // 요청 본문 확인
    const body = await request.json()
    const { userId, email, companyName, businessNumber } = body

    if (!userId || !email) {
      return NextResponse.json(
        { error: '필수 필드가 없습니다. userId와 email이 필요합니다.' },
        { status: 400 }
      )
    }

    // 회사명과 사업자등록번호 검증
    if (!companyName || companyName.trim() === '' || companyName === '임시회사명') {
      return NextResponse.json(
        { error: '유효한 회사명을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!businessNumber || businessNumber.trim() === '' || businessNumber.startsWith('TEMP-')) {
      return NextResponse.json(
        { error: '유효한 사업자등록번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    // Admin 클라이언트 생성 (Service Role 키 사용)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. auth.users에 사용자가 실제로 존재하는지 확인
    // Service Role을 사용하여 auth.admin API로 사용자 존재 확인
    
    // 1-0. auth.users에 사용자가 존재하는지 확인 (최대 5회 시도, 총 5초)
    let userExists = false
    let userCheckAttempts = 0
    const maxUserCheckAttempts = 5
    
    console.log('사용자 존재 확인 시작...')
    
    while (!userExists && userCheckAttempts < maxUserCheckAttempts) {
      userCheckAttempts++
      console.log(`사용자 존재 확인 시도 ${userCheckAttempts}/${maxUserCheckAttempts}...`)
      
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
        
        if (!userError && userData?.user) {
          userExists = true
          console.log('✅ 사용자 존재 확인 완료:', userData.user.email)
          break
        } else {
          console.log(`사용자 확인 실패 (시도 ${userCheckAttempts}/${maxUserCheckAttempts}):`, userError?.message || '사용자를 찾을 수 없음')
        }
      } catch (error: any) {
        console.log(`사용자 확인 오류 (시도 ${userCheckAttempts}/${maxUserCheckAttempts}):`, error.message)
      }
      
      if (!userExists && userCheckAttempts < maxUserCheckAttempts) {
        // 1초 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    if (!userExists) {
      console.error('❌ 사용자 존재 확인 실패: auth.users에 사용자가 없습니다.')
      return NextResponse.json(
        { 
          error: `프로필 생성 실패: auth.users에 사용자가 존재하지 않습니다. 회원가입이 완료되지 않았거나 이메일 확인이 필요할 수 있습니다.`,
          details: `사용자 ID: ${userId}`,
          suggestion: '회원가입 후 이메일 확인을 완료한 후 다시 시도해주세요.',
          attempts: maxUserCheckAttempts
        },
        { status: 400 }
      )
    }
    
    // 사용자 확인 후 추가 대기 (트리거가 프로필을 생성할 시간 확보)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 1-1. 프로필이 이미 있는지 확인
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (checkError && !checkError.message.includes('No rows')) {
      console.error('프로필 확인 오류:', checkError)
      return NextResponse.json(
        { error: `프로필 확인 실패: ${checkError.message}` },
        { status: 500 }
      )
    }

    if (existingProfile) {
      console.log('프로필이 이미 존재함:', existingProfile)
      return NextResponse.json({
        success: true,
        message: '프로필이 이미 존재합니다.',
        profile: existingProfile
      })
    }

    // 2. 프로필 생성 시도 (최대 5회 재시도)
    // 사용자가 존재하는 것을 확인했으므로, 프로필 생성이 실패하면 재시도
    let newProfile = null
    let createError = null
    const maxRetries = 5
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`프로필 생성 시도 ${attempt}/${maxRetries}...`)
      
      // 각 시도 전에 사용자 존재 재확인 (선택적)
      if (attempt > 1) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
          if (userError || !userData?.user) {
            console.error(`사용자 존재 확인 실패 (시도 ${attempt}):`, userError?.message)
            return NextResponse.json(
              { 
                error: `프로필 생성 실패: auth.users에 사용자가 존재하지 않습니다.`,
                details: userError?.message || '사용자를 찾을 수 없습니다.',
                attempt: attempt
              },
              { status: 400 }
            )
          }
        } catch (checkError: any) {
          console.warn(`사용자 확인 오류 (시도 ${attempt}):`, checkError.message)
        }
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          company_name: companyName.trim(), // 공백 제거
          business_number: businessNumber.replace(/-/g, ''), // 하이픈 제거
          role: 'user', // 기본 역할은 'user'
          license_verification_status: 'pending'
        })
        .select()
        .single()

      if (!error && data) {
        newProfile = data
        console.log(`✅ 프로필 생성 성공 (시도 ${attempt}/${maxRetries})`)
        break
      }

      createError = error
      
      // 외래키 제약조건 오류인 경우 재시도
      if (error && (error.message.includes('foreign key constraint') || 
                    error.message.includes('profiles_id_fkey') ||
                    error.code === '23503')) {
        console.log(`외래키 제약조건 오류 (시도 ${attempt}/${maxRetries}), 재시도 대기 중...`)
        
        if (attempt < maxRetries) {
          // 재시도 전 대기 (시도 횟수에 따라 대기 시간 증가: 1초, 2초, 3초, 4초)
          const waitTime = 1000 * attempt
          console.log(`${waitTime}ms 대기 후 재시도...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        } else {
          // 최대 재시도 횟수 초과
          console.error('❌ 모든 재시도 실패')
          return NextResponse.json(
            { 
              error: `프로필 생성 실패: auth.users에 사용자가 존재하지 않습니다. 회원가입이 완료되지 않았거나 이메일 확인이 필요할 수 있습니다.`,
              details: createError?.message || '알 수 없는 오류',
              suggestion: '회원가입 후 이메일 확인을 완료한 후 다시 시도해주세요.',
              attempts: maxRetries,
              userId: userId
            },
            { status: 400 }
          )
        }
      } else {
        // 다른 오류인 경우 즉시 반환
        console.error('프로필 생성 오류:', createError)
        return NextResponse.json(
          { 
            error: `프로필 생성 실패: ${createError.message}`,
            details: createError,
            attempt: attempt
          },
          { status: 500 }
        )
      }
    }

    if (!newProfile) {
      console.error('❌ 프로필 생성 최종 실패')
      return NextResponse.json(
        { 
          error: `프로필 생성 실패: 모든 재시도가 실패했습니다.`,
          details: createError?.message || '알 수 없는 오류',
          attempts: maxRetries,
          userId: userId
        },
        { status: 500 }
      )
    }

    console.log('✅ 프로필 생성 성공:', newProfile)
    console.log('프로필 정보:', {
      id: newProfile.id,
      email: newProfile.email,
      company_name: newProfile.company_name,
      business_number: newProfile.business_number,
      role: newProfile.role
    })

    return NextResponse.json({
      success: true,
      message: '프로필이 생성되었습니다.',
      profile: newProfile
    })
  } catch (error: any) {
    console.error('프로필 생성 API 오류:', error)
    return NextResponse.json(
      { error: error.message || '프로필 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


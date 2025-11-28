import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // 여러 파라미터 이름 형식 지원 (camelCase와 snake_case)
    const userId = body.userId || body.user_id
    const companyName = body.companyName || body.company_name
    const businessNumber = body.businessNumber || body.business_number
    const phoneNumber = body.phoneNumber || body.phone_number
    const address = body.address
    const accountNumber = body.accountNumber || body.account_number

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 필수 필드 검증 (빈 문자열도 체크)
    if (!companyName || companyName.trim() === '') {
      return NextResponse.json(
        { success: false, error: '회사명은 필수 항목입니다.' },
        { status: 400 }
      )
    }
    
    if (!businessNumber || businessNumber.trim() === '') {
      return NextResponse.json(
        { success: false, error: '사업자등록번호는 필수 항목입니다.' },
        { status: 400 }
      )
    }
    
    if (!phoneNumber || phoneNumber.trim() === '') {
      return NextResponse.json(
        { success: false, error: '전화번호는 필수 항목입니다.' },
        { status: 400 }
      )
    }
    
    if (!address || address.trim() === '') {
      return NextResponse.json(
        { success: false, error: '주소는 필수 항목입니다.' },
        { status: 400 }
      )
    }
    
    if (!accountNumber || accountNumber.trim() === '') {
      return NextResponse.json(
        { success: false, error: '계좌번호는 필수 항목입니다.' },
        { status: 400 }
      )
    }

    // "임시회사명"이나 "TEMP-"로 시작하는 값은 허용하지 않음
    if (companyName === '임시회사명' || companyName.trim() === '') {
      return NextResponse.json(
        { success: false, error: '유효한 회사명을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (businessNumber.startsWith('TEMP-')) {
      return NextResponse.json(
        { success: false, error: '유효한 사업자등록번호를 입력해주세요.' },
        { status: 400 }
      )
    }

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

    // 프로필 업데이트
    const updateData: any = {
      company_name: companyName,
      business_number: businessNumber,
      phone_number: phoneNumber,
      address: address,
      account_number: accountNumber,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('프로필 업데이트 오류:', error)
      return NextResponse.json(
        { success: false, error: `프로필 업데이트 실패: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
      profile: data,
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


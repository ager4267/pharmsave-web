import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 관리자 프로필 조회 API
 * GET /api/admin/get-admin-profile
 * 
 * 관리자(role='admin')의 프로필 정보를 조회합니다.
 * 입금 계좌 정보 표시용으로 사용됩니다.
 */
export async function GET() {
  try {
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

    // 관리자 프로필 조회
    const { data: adminProfile, error } = await supabase
      .from('profiles')
      .select('company_name, bank_name, account_number, phone_number')
      .eq('role', 'admin')
      .maybeSingle()

    if (error) {
      console.error('❌ 관리자 프로필 조회 오류:', error)
      return NextResponse.json(
        { error: `관리자 프로필 조회 실패: ${error.message}` },
        { status: 500 }
      )
    }

    if (!adminProfile) {
      return NextResponse.json(
        { error: '관리자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: {
        company_name: adminProfile.company_name,
        bank_name: adminProfile.bank_name,
        account_number: adminProfile.account_number,
        phone_number: adminProfile.phone_number,
      },
    })
  } catch (error: any) {
    console.error('❌ API 오류:', error)
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


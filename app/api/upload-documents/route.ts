import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    if (!supabase || !supabase.auth) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
      return NextResponse.json(
        { error: '서버 설정 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    // 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const formData = await request.formData()
    const licenseFile = formData.get('licenseFile') as File
    const businessFile = formData.get('businessFile') as File

    if (!licenseFile || !businessFile) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 파일 업로드
    const licenseFileName = `${userId}/license_${Date.now()}.${licenseFile.name.split('.').pop()}`
    const { error: licenseError } = await supabase.storage
      .from('documents')
      .upload(licenseFileName, licenseFile, {
        cacheControl: '3600',
        upsert: false
      })

    if (licenseError) {
      console.error('도매업 허가증 업로드 오류:', licenseError)
      return NextResponse.json(
        { error: `도매업 허가증 업로드 실패: ${licenseError.message}` },
        { status: 500 }
      )
    }

    const businessFileName = `${userId}/business_${Date.now()}.${businessFile.name.split('.').pop()}`
    const { error: businessError } = await supabase.storage
      .from('documents')
      .upload(businessFileName, businessFile, {
        cacheControl: '3600',
        upsert: false
      })

    if (businessError) {
      console.error('사업자등록증 업로드 오류:', businessError)
      return NextResponse.json(
        { error: `사업자등록증 업로드 실패: ${businessError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      licenseFileName,
      businessFileName
    })
  } catch (error) {
    console.error('파일 업로드 API 오류:', error)
    return NextResponse.json(
      { error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


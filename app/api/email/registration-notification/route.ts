import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, company_name, business_number } = body

    // 필수 필드 검증
    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 실제 이메일 전송 로직은 여기에 구현
    // 예: nodemailer, SendGrid, Resend 등 사용
    
    // 로컬 개발 환경에서는 콘솔에 출력
    console.log('=== 회원가입 알림 이메일 ===')
    console.log('관리자에게 전송할 이메일 내용:')
    console.log(`새로운 회원가입 신청이 있습니다.`)
    console.log(`사용자 ID: ${userId}`)
    console.log(`이메일: ${email}`)
    console.log(`회사명: ${company_name || '없음'}`)
    console.log(`사업자등록번호: ${business_number || '없음'}`)
    console.log('==========================')

    // 실제 이메일 전송 (예시)
    // const emailService = new EmailService()
    // await emailService.sendRegistrationNotification({
    //   to: 'admin@example.com',
    //   userId,
    //   email,
    //   company_name,
    //   business_number,
    // })

    return NextResponse.json({ success: true, message: '이메일 전송 완료' })
  } catch (error: any) {
    console.error('이메일 전송 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '이메일 전송 실패' },
      { status: 500 }
    )
  }
}


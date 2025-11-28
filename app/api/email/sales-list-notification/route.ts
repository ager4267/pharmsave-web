import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { salesListId, sellerId, itemCount } = body

    // 필수 필드 검증
    if (!salesListId || !sellerId) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 실제 이메일 전송 로직은 여기에 구현
    console.log('=== 판매 리스트 알림 이메일 ===')
    console.log('관리자에게 전송할 이메일 내용:')
    console.log(`새로운 판매 리스트가 제출되었습니다.`)
    console.log(`판매 리스트 ID: ${salesListId}`)
    console.log(`판매자 ID: ${sellerId}`)
    console.log(`상품 수: ${itemCount || 0}개`)
    console.log('==========================')

    return NextResponse.json({ success: true, message: '이메일 전송 완료' })
  } catch (error: any) {
    console.error('이메일 전송 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '이메일 전송 실패' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, period, statistics, expiringCount, deadStockCount } = body

    // 필수 필드 검증
    if (!userId || !statistics) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 실제 이메일 전송 로직은 여기에 구현
    console.log('=== 재고 분석 결과 알림 이메일 ===')
    console.log('관리자에게 전송할 이메일 내용:')
    console.log(`사용자 ID: ${userId}의 재고 분석 결과`)
    console.log(`분석 기간: ${period === '3months' ? '3개월' : '6개월'}`)
    console.log(`총 재고 수: ${statistics?.total_items || 0}`)
    console.log(`유효기간 임박 재고: ${expiringCount || 0}개`)
    console.log(`불용 재고: ${deadStockCount || 0}개`)
    if (statistics?.expiring_percentage !== undefined) {
      console.log(`유효기간 임박 재고 비율: ${statistics.expiring_percentage.toFixed(2)}%`)
    }
    if (statistics?.dead_stock_percentage !== undefined) {
      console.log(`불용 재고 비율: ${statistics.dead_stock_percentage.toFixed(2)}%`)
    }
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


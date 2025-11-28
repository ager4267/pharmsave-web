import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      purchaseRequestId, 
      buyerId,
      buyerCompanyName,
      buyerEmail,
      productId, 
      sellerId, 
      sellerCompanyName,
      sellerEmail,
      productName,
      quantity, 
      totalPrice,
      commission 
    } = body

    // 필수 필드 검증
    if (!purchaseRequestId || !buyerId || !productId || !sellerId) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 실제 이메일 전송 로직은 여기에 구현
    console.log('=== 구매 요청 알림 이메일 ===')
    console.log('관리자에게 전송할 이메일 내용:')
    console.log(`새로운 구매 요청이 제출되었습니다.`)
    console.log(`구매 요청 ID: ${purchaseRequestId}`)
    console.log(`구매자 정보:`)
    console.log(`  - 회사명: ${buyerCompanyName || '알 수 없음'}`)
    console.log(`  - 이메일: ${buyerEmail || '알 수 없음'}`)
    console.log(`  - 구매자 ID: ${buyerId}`)
    console.log(`판매자 정보:`)
    console.log(`  - 회사명: ${sellerCompanyName || '알 수 없음'}`)
    console.log(`  - 이메일: ${sellerEmail || '알 수 없음'}`)
    console.log(`  - 판매자 ID: ${sellerId}`)
    console.log(`상품명: ${productName || '알 수 없음'}`)
    console.log(`상품 ID: ${productId}`)
    console.log(`수량: ${quantity || 0}개`)
    console.log(`총 금액: ${totalPrice ? totalPrice.toLocaleString() : 0}원`)
    console.log(`예상 중개 수수료 (5%): ${commission ? commission.toLocaleString() : (totalPrice ? (totalPrice * 0.05).toLocaleString() : 0)}원`)
    console.log('==========================')

    return NextResponse.json({ success: true, message: '이메일 전송 완료' })
  } catch (error: any) {
    console.error('이메일 전송 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '이메일 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


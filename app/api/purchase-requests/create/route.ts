import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Product } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const { productId, quantity, shippingAddress, userId } = await request.json()

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: '상품 ID와 수량을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
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

    // 사용자 인증 확인
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 사용자 프로필 확인
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 상품 정보 조회 (판매자 정보 포함)
    const { data: product, error: productError } = await supabase
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(
          id,
          company_name,
          email
        )
      `)
      .eq('id', productId)
      .eq('status', 'active')
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없거나 구매할 수 없는 상태입니다.' },
        { status: 404 }
      )
    }

    // 수량 검증
    if (quantity > product.quantity) {
      return NextResponse.json(
        { 
          success: false, 
          error: `구매 수량이 판매 수량을 초과할 수 없습니다. (최대: ${product.quantity}개)` 
        },
        { status: 400 }
      )
    }

    // 구매 요청 생성
    const unitPrice = Number(product.selling_price)
    const totalPrice = unitPrice * quantity

    const { data: purchaseRequest, error: insertError } = await supabase
      .from('purchase_requests')
      .insert({
        buyer_id: userId,
        product_id: productId,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        shipping_address: shippingAddress || null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('구매 요청 생성 오류:', insertError)
      return NextResponse.json(
        { success: false, error: `구매 요청 생성에 실패했습니다: ${insertError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 구매 요청 생성 성공:', {
      id: purchaseRequest.id,
      product: product.product_name,
      quantity: quantity,
      totalPrice: totalPrice,
    })

    // 판매자 정보 조회
    let sellerInfo: any = null
    if (product.seller_id) {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('id, company_name, email')
        .eq('id', product.seller_id)
        .single()
      
      if (sellerProfile) {
        sellerInfo = sellerProfile
      }
    }

    // 구매자 정보 조회
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('id, company_name, email')
      .eq('id', userId)
      .single()

    // 관리자에게 구매 요청 알림 전송 (판매자 정보 포함)
    try {
      // 동적으로 현재 요청의 origin을 사용하여 URL 생성
      // Vercel 프로덕션 환경에서도 정상 작동하도록 개선
      let baseUrl: string
      
      if (process.env.NEXT_PUBLIC_SITE_URL) {
        // 환경 변수에 명시적으로 설정된 경우 사용
        baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      } else if (process.env.VERCEL_URL) {
        // Vercel 자동 제공 환경 변수 사용
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        // request headers에서 origin 추출 (프로덕션/개발 모두 지원)
        const origin = request.headers.get('origin') || request.headers.get('host')
        if (origin) {
          // origin이 'https://' 또는 'http://'로 시작하지 않으면 추가
          baseUrl = origin.startsWith('http') ? origin : `https://${origin}`
        } else {
          // fallback: 로컬 개발 환경
          baseUrl = 'http://localhost:3000'
        }
      }
      
      const notificationUrl = `${baseUrl}/api/email/purchase-request-notification`
      
      console.log('📧 이메일 알림 전송 시도:', { notificationUrl, baseUrl })
      
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseRequestId: purchaseRequest.id,
          buyerId: userId,
          buyerCompanyName: buyerProfile?.company_name || '알 수 없음',
          buyerEmail: buyerProfile?.email || '알 수 없음',
          productId: productId,
          sellerId: product.seller_id,
          sellerCompanyName: sellerInfo?.company_name || '알 수 없음',
          sellerEmail: sellerInfo?.email || '알 수 없음',
          productName: product.product_name,
          quantity: quantity,
          totalPrice: totalPrice,
          commission: totalPrice * 0.05, // 5% 수수료
        }),
      })
    } catch (emailError) {
      console.error('구매 요청 알림 이메일 전송 실패:', emailError)
      // 이메일 전송 실패해도 구매 요청은 성공으로 처리
    }

    return NextResponse.json({
      success: true,
      purchaseRequest: purchaseRequest,
      message: '구매 요청이 성공적으로 제출되었습니다.',
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


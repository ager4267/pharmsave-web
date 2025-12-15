import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { purchaseRequestId, status, adminUserId } = await request.json()

    if (!purchaseRequestId || !status) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 없습니다.' },
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

    // 관리자 권한 확인
    if (adminUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', adminUserId)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: '관리자 권한이 필요합니다.' },
          { status: 403 }
        )
      }
    }

    // 구매 요청 조회
    const { data: purchaseRequest, error: purchaseRequestError } = await supabase
      .from('purchase_requests')
      .select('*, products:products!purchase_requests_product_id_fkey(*)')
      .eq('id', purchaseRequestId)
      .single()

    if (purchaseRequestError || !purchaseRequest) {
      return NextResponse.json(
        { success: false, error: '구매 요청을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 상태 업데이트
    const { error: updateError } = await supabase
      .from('purchase_requests')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId || null,
      })
      .eq('id', purchaseRequestId)

    if (updateError) {
      console.error('구매 요청 상태 업데이트 오류:', updateError)
      return NextResponse.json(
        { success: false, error: '상태 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 승인된 경우 상품 수량 감소 및 상태 업데이트, 중개 수수료 계산
    if (status === 'approved') {
      const product = purchaseRequest.products
      if (product) {
        const requestedQuantity = purchaseRequest.quantity
        const currentQuantity = product.quantity
        
        // 수량 검증
        if (requestedQuantity > currentQuantity) {
          return NextResponse.json(
            { success: false, error: `구매 수량(${requestedQuantity})이 현재 재고(${currentQuantity})를 초과합니다.` },
            { status: 400 }
          )
        }
        
        // 중개 수수료 계산 (매출 금액의 5%)
        const totalPrice = Number(purchaseRequest.total_price)
        const commission = totalPrice * 0.05 // 5% 수수료
        
        console.log('💰 중개 수수료 계산:', {
          totalPrice,
          commission,
          commissionRate: '5%',
        })
        
        // 수량 감소
        const newQuantity = currentQuantity - requestedQuantity
        
        // 수량이 0 이하가 되면 status를 'sold'로 변경하고 quantity는 1로 유지
        // (CHECK 제약조건 quantity > 0 때문에)
        // 아니면 'active' 유지하고 실제 수량으로 업데이트
        const updateData: any = {
          updated_at: new Date().toISOString(),
        }
        
        if (newQuantity <= 0) {
          // 수량이 모두 판매되면 status를 'sold'로 변경
          // quantity는 CHECK 제약조건 때문에 1로 유지
          updateData.status = 'sold'
          updateData.quantity = 1
        } else {
          // 수량이 남아있으면 active 상태 유지하고 실제 수량으로 업데이트
          updateData.status = 'active'
          updateData.quantity = newQuantity
        }
        
        const { error: productUpdateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', product.id)

        if (productUpdateError) {
          console.error('상품 수량/상태 업데이트 오류:', productUpdateError)
          // 구매 요청은 승인되었지만 상품 상태 업데이트 실패
          return NextResponse.json({
            success: true,
            warning: '구매 요청은 승인되었지만 상품 수량/상태 업데이트에 실패했습니다.',
            purchaseRequestId: purchaseRequestId,
          })
        }

        console.log('✅ 상품 수량 감소 및 상태 업데이트:', {
          productId: product.id,
          requestedQuantity,
          previousQuantity: currentQuantity,
          newQuantity,
          newStatus: updateData.status,
        })
        
        // 중개 수수료 정보를 purchase_orders 테이블에 저장
        const purchasePrice = totalPrice - commission // 판매자에게 지급할 금액 (총액 - 수수료)
        const totalAmount = totalPrice // 구매자가 지불할 총액
        
        const { data: purchaseOrder, error: orderError } = await supabase
          .from('purchase_orders')
          .insert({
            purchase_request_id: purchaseRequestId,
            seller_id: product.seller_id,
            product_id: product.id,
            product_name: product.product_name,
            quantity: requestedQuantity,
            purchase_price: purchasePrice, // 판매자에게 지급할 금액
            commission: commission, // 중개 수수료 (5%)
            total_amount: totalAmount, // 구매자가 지불할 총액
            status: 'approved', // 관리자가 승인했으므로 바로 approved
          })
          .select()
          .single()

        if (orderError) {
          console.error('구매 주문 생성 오류:', orderError)
          // 주문 생성 실패해도 구매 요청은 승인된 상태로 유지
          console.warn('⚠️ 중개 수수료 정보 저장 실패:', orderError.message)
        } else {
          console.log('✅ 중개 수수료 정보 저장 성공:', {
            purchaseOrderId: purchaseOrder?.id,
            purchaseRequestId: purchaseRequestId,
            totalPrice,
            commission,
            purchasePrice,
            buyerId: purchaseRequest.buyer_id,
            sellerId: product.seller_id,
          })

          // 판매 승인 보고서 생성
          try {
            // 보고서 번호 생성 (SAR-YYYY-XXXX 형식)
            const year = new Date().getFullYear()
            const { data: existingReports } = await supabase
              .from('sales_approval_reports')
              .select('report_number')
              .like('report_number', `SAR-${year}-%`)
              .order('report_number', { ascending: false })
              .limit(1)

            let sequenceNum = 1
            if (existingReports && existingReports.length > 0) {
              const lastReportNum = existingReports[0].report_number
              const lastSequence = parseInt(lastReportNum.split('-')[2]) || 0
              sequenceNum = lastSequence + 1
            }

            const reportNumber = `SAR-${year}-${String(sequenceNum).padStart(4, '0')}`

            // 판매 승인 보고서 생성 (구매요청 승인 시 자동으로 판매자에게 전달)
            const currentTime = new Date().toISOString()
            const { data: report, error: reportError } = await supabase
              .from('sales_approval_reports')
              .insert({
                purchase_request_id: purchaseRequestId,
                purchase_order_id: purchaseOrder?.id,
                seller_id: product.seller_id,
                buyer_id: purchaseRequest.buyer_id,
                product_id: product.id,
                product_name: product.product_name,
                quantity: requestedQuantity,
                unit_price: Number(product.selling_price),
                total_amount: totalAmount,
                commission: commission,
                seller_amount: purchasePrice,
                report_number: reportNumber,
                status: 'sent', // 구매요청 승인 시 자동으로 판매자에게 전달
                sent_at: currentTime, // 전달 시간 기록
                shipping_address: purchaseRequest.shipping_address || null,
              })
              .select()
              .single()

            if (reportError) {
              console.error('판매 승인 보고서 생성 오류:', reportError)
              console.warn('⚠️ 판매 승인 보고서 생성 실패:', reportError.message)
            } else {
              console.log('✅ 판매 승인 보고서 생성 및 자동 전달 성공:', {
                reportId: report?.id,
                reportNumber: reportNumber,
                purchaseRequestId: purchaseRequestId,
                sellerId: product.seller_id,
                status: 'sent',
              })
            }
          } catch (reportCreateError: any) {
            console.error('판매 승인 보고서 생성 중 오류:', reportCreateError)
            // 보고서 생성 실패해도 구매 요청 승인은 유지
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `구매 요청이 ${status === 'approved' ? '승인' : status === 'rejected' ? '거부' : '업데이트'}되었습니다.`,
      purchaseRequestId: purchaseRequestId,
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


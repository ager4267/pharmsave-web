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

    // 구매 요청 조회 (products의 seller_id 포함)
    const { data: purchaseRequest, error: purchaseRequestError } = await supabase
      .from('purchase_requests')
      .select('*, products:products!purchase_requests_product_id_fkey(id, product_name, seller_id, quantity, selling_price, status)')
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
      // products가 배열인 경우 첫 번째 요소 사용, 객체인 경우 그대로 사용
      const product = Array.isArray(purchaseRequest.products) 
        ? purchaseRequest.products[0] 
        : purchaseRequest.products
      
      if (product) {
        console.log('📦 상품 정보 확인:', {
          productId: product.id,
          productName: product.product_name,
          sellerId: product.seller_id,
          quantity: product.quantity,
          sellingPrice: product.selling_price,
          productData: product, // 전체 상품 데이터 로깅
        })
        
        // seller_id가 없는 경우 products 테이블에서 직접 조회
        if (!product.seller_id) {
          console.warn('⚠️ product.seller_id가 없습니다. products 테이블에서 직접 조회합니다.')
          const { data: productData, error: productError } = await supabase
            .from('products')
            .select('id, product_name, seller_id, quantity, selling_price, status')
            .eq('id', product.id)
            .single()
          
          if (productError || !productData) {
            console.error('❌ 상품 조회 오류:', productError)
            return NextResponse.json(
              { success: false, error: '상품 정보를 찾을 수 없습니다.' },
              { status: 404 }
            )
          }
          
          // product 객체 업데이트
          product.seller_id = productData.seller_id
          product.quantity = productData.quantity
          product.selling_price = productData.selling_price
          product.status = productData.status
          
          console.log('✅ 상품 정보 업데이트:', {
            productId: product.id,
            sellerId: product.seller_id,
          })
        }
        const requestedQuantity = purchaseRequest.quantity
        const currentQuantity = product.quantity
        
        // 수량 검증
        if (requestedQuantity > currentQuantity) {
          return NextResponse.json(
            { success: false, error: `구매 수량(${requestedQuantity})이 현재 재고(${currentQuantity})를 초과합니다.` },
            { status: 400 }
          )
        }
        
        // seller_id 검증 (purchase_orders 생성 전에 수행)
        if (!product.seller_id) {
          console.error('❌ 상품의 seller_id가 없습니다:', product)
          return NextResponse.json(
            { success: false, error: '상품 정보에 판매자 ID가 없습니다.' },
            { status: 400 }
          )
        }
        
        // 중개 수수료 계산 (매출 금액의 5%)
        // 변수 스코프 명확화: 블록 외부에서 정의하여 이후 로직에서 사용
        const totalPrice = Number(purchaseRequest.total_price)
        const commission = totalPrice * 0.05 // 5% 수수료
        const purchasePrice = totalPrice - commission // 판매자에게 지급할 금액 (총액 - 수수료)
        const totalAmount = totalPrice // 구매자가 지불할 총액
        
        console.log('💰 중개 수수료 계산:', {
          totalPrice,
          commission,
          commissionRate: '5%',
          purchasePrice,
          totalAmount,
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
          console.error('❌ 상품 수량/상태 업데이트 오류:', productUpdateError)
          return NextResponse.json({
            success: false,
            error: '상품 수량/상태 업데이트에 실패했습니다.',
            details: productUpdateError.message,
            purchaseRequestId: purchaseRequestId,
          }, { status: 500 })
        }

        console.log('✅ 상품 수량 감소 및 상태 업데이트:', {
          productId: product.id,
          requestedQuantity,
          previousQuantity: currentQuantity,
          newQuantity,
          newStatus: updateData.status,
        })

        // 중개 수수료 정보를 purchase_orders 테이블에 저장
        
        // 에러 수집을 위한 배열
        const errors: string[] = []
        const warnings: string[] = []

        // 중개 수수료 정보를 purchase_orders 테이블에 저장
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
          console.error('❌ 구매 주문 생성 오류:', orderError)
          console.error('❌ 오류 상세:', {
            message: orderError.message,
            details: orderError.details,
            hint: orderError.hint,
            code: orderError.code,
          })
          errors.push(`구매 주문 생성 실패: ${orderError.message}`)
        } else if (purchaseOrder) {
          console.log('✅ 중개 수수료 정보 저장 성공:', {
            purchaseOrderId: purchaseOrder.id,
            purchaseRequestId: purchaseRequestId,
            totalPrice,
            commission,
            purchasePrice,
            buyerId: purchaseRequest.buyer_id,
            sellerId: product.seller_id,
          })
        } else {
          errors.push('구매 주문 생성되었지만 데이터가 반환되지 않음')
        }

        // 판매 승인 보고서 생성
        // purchaseOrder 생성 실패 시에도 보고서는 생성하되, purchase_order_id는 null로 저장
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
          
          // seller_id 최종 확인 및 로깅
          console.log('📝 판매 승인 보고서 생성 준비:', {
            sellerId: product.seller_id,
            buyerId: purchaseRequest.buyer_id,
            productId: product.id,
            productName: product.product_name,
            reportNumber: reportNumber,
            purchaseRequestId: purchaseRequestId,
            purchaseOrderId: purchaseOrder?.id || null,
          })
          
          // seller_id가 유효한 UUID인지 확인
          if (!product.seller_id || typeof product.seller_id !== 'string') {
            console.error('❌ seller_id가 유효하지 않습니다:', product.seller_id)
            errors.push(`판매자 ID가 유효하지 않습니다: ${product.seller_id}`)
          } else {
            const { data: report, error: reportError } = await supabase
              .from('sales_approval_reports')
              .insert({
                purchase_request_id: purchaseRequestId,
                purchase_order_id: purchaseOrder?.id || null, // purchaseOrder가 없어도 null로 저장
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
              console.error('❌ 판매 승인 보고서 생성 오류:', reportError)
              console.error('❌ 오류 상세:', {
                message: reportError.message,
                details: reportError.details,
                hint: reportError.hint,
                code: reportError.code,
              })
              errors.push(`판매 승인 보고서 생성 실패: ${reportError.message}`)
            } else if (report) {
            console.log('✅ 판매 승인 보고서 생성 및 자동 전달 성공:', {
              reportId: report.id,
              reportNumber: reportNumber,
              purchaseRequestId: purchaseRequestId,
              sellerId: product.seller_id,
              status: 'sent',
              purchaseOrderId: purchaseOrder?.id || '없음',
              createdAt: report.created_at,
              sentAt: report.sent_at,
            })
            
            // 생성된 보고서가 실제로 seller_id와 일치하는지 확인
            if (report.seller_id !== product.seller_id) {
              console.error('❌ 판매 승인 보고서의 seller_id 불일치:', {
                expected: product.seller_id,
                actual: report.seller_id,
                reportId: report.id,
              })
            }
            
            // 보고서 생성 후 즉시 조회하여 실제로 저장되었는지 확인 (maybeSingle 사용)
            const { data: verifyReport, error: verifyError } = await supabase
              .from('sales_approval_reports')
              .select('id, report_number, seller_id, status, sent_at')
              .eq('id', report.id)
              .maybeSingle()
            
            if (verifyError) {
              console.error('❌ 생성된 보고서 확인 실패:', verifyError)
            } else if (!verifyReport) {
              console.warn('⚠️ 생성된 보고서를 찾을 수 없습니다:', report.id)
            } else if (verifyReport) {
              console.log('✅ 생성된 보고서 확인 성공:', {
                reportId: verifyReport.id,
                reportNumber: verifyReport.report_number,
                sellerId: verifyReport.seller_id,
                status: verifyReport.status,
                sentAt: verifyReport.sent_at,
              })
              
              // seller_id로 조회하여 판매자가 볼 수 있는지 확인
              const { data: sellerReports, error: sellerError } = await supabase
                .from('sales_approval_reports')
                .select('id, report_number, seller_id, status')
                .eq('seller_id', product.seller_id)
                .eq('id', report.id)
              
              if (sellerError) {
                console.error('❌ 판매자별 보고서 조회 실패:', sellerError)
              } else {
                console.log('✅ 판매자별 보고서 조회 성공:', {
                  sellerId: product.seller_id,
                  found: sellerReports && sellerReports.length > 0,
                  count: sellerReports?.length || 0,
                })
              }
            }
            } else {
              console.error('❌ 판매 승인 보고서 생성되었지만 데이터가 반환되지 않음')
            }
          }
        } catch (reportCreateError: any) {
          console.error('❌ 판매 승인 보고서 생성 중 예외 발생:', reportCreateError)
          console.error('❌ 예외 상세:', {
            message: reportCreateError.message,
            stack: reportCreateError.stack,
            name: reportCreateError.name,
          })
          errors.push(`판매 승인 보고서 생성 중 예외: ${reportCreateError.message}`)
        }

        // 에러가 있는 경우 사용자에게 명확히 전달
        if (errors.length > 0) {
          // purchase_orders 생성 실패는 경고로 처리 (보고서는 생성됨)
          const criticalErrors = errors.filter(e => !e.includes('구매 주문 생성'))
          const nonCriticalErrors = errors.filter(e => e.includes('구매 주문 생성'))
          
          if (criticalErrors.length > 0) {
            // 중요한 에러가 있는 경우 실패로 처리
            return NextResponse.json({
              success: false,
              error: '구매 요청 승인 중 일부 작업이 실패했습니다.',
              details: criticalErrors,
              warnings: nonCriticalErrors.length > 0 ? nonCriticalErrors : undefined,
              purchaseRequestId: purchaseRequestId,
            }, { status: 500 })
          } else if (nonCriticalErrors.length > 0) {
            // purchase_orders 생성 실패만 있는 경우 경고로 처리
            return NextResponse.json({
              success: true,
              message: `구매 요청이 승인되었습니다. 다만 일부 정보 저장에 실패했습니다.`,
              warnings: nonCriticalErrors,
              purchaseRequestId: purchaseRequestId,
            }, { status: 200 })
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


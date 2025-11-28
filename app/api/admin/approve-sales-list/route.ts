import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { SalesListItem } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const { listId, status, adminUserId } = await request.json()

    if (!listId || !status) {
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

    // 판매 리스트 조회
    const { data: salesList, error: salesListError } = await supabase
      .from('sales_lists')
      .select('*')
      .eq('id', listId)
      .single()

    if (salesListError || !salesList) {
      return NextResponse.json(
        { success: false, error: '판매 리스트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 상태 업데이트
    const { error: updateError } = await supabase
      .from('sales_lists')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId || null,
      })
      .eq('id', listId)

    if (updateError) {
      console.error('상태 업데이트 오류:', updateError)
      return NextResponse.json(
        { success: false, error: '상태 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 승인된 경우 products 테이블에 상품 등록
    let insertResults: any[] = []
    
    if (status === 'approved') {
      const items = Array.isArray(salesList.items) ? salesList.items : []
      
      if (items.length > 0) {
        const productsToInsert = items
          .filter((item: SalesListItem) => {
            // 필수 필드 검증
            if (!item.product_name || !item.selling_price || !item.quantity) {
              console.warn('필수 필드가 누락된 상품 건너뜀:', item)
              return false
            }
            // 수량과 가격이 0보다 큰지 확인
            if (item.quantity <= 0 || item.selling_price <= 0) {
              console.warn('수량 또는 가격이 유효하지 않은 상품 건너뜀:', item)
              return false
            }
            return true
          })
          .map((item: SalesListItem) => {
            // expiry_date를 DATE 형식으로 변환 (문자열인 경우)
            let expiryDate = null
            if (item.expiry_date) {
              try {
                const date = new Date(item.expiry_date)
                if (!isNaN(date.getTime())) {
                  expiryDate = date.toISOString().split('T')[0] // YYYY-MM-DD 형식
                }
              } catch (e) {
                console.warn('유효기간 파싱 오류:', item.expiry_date)
              }
            }

            return {
              sales_list_id: listId,
              seller_id: salesList.seller_id,
              product_name: item.product_name,
              specification: item.specification || null,
              manufacturer: item.manufacturer || null,
              manufacturing_number: item.manufacturing_number || null,
              expiry_date: expiryDate,
              quantity: Number(item.quantity),
              insurance_price: item.insurance_price ? Number(item.insurance_price) : null,
              selling_price: Number(item.selling_price),
              discount_rate: item.discount_rate ? Number(item.discount_rate) : null,
              storage_condition: item.storage_condition || null,
              description: item.description || null,
              status: 'active',
            }
          })

        if (productsToInsert.length === 0) {
          console.warn('등록할 수 있는 유효한 상품이 없습니다.')
          return NextResponse.json({
            success: true,
            warning: '상태는 업데이트되었지만 등록할 수 있는 유효한 상품이 없습니다.',
          })
        }

        // 이미 등록된 상품이 있는지 확인
        const { data: existingProducts } = await supabase
          .from('products')
          .select('id')
          .eq('sales_list_id', listId)

        if (existingProducts && existingProducts.length > 0) {
          console.log('이미 등록된 상품이 있습니다. 건너뜁니다:', existingProducts.length, '개')
          return NextResponse.json({
            success: true,
            message: `판매 요청이 승인되었습니다. (이미 상품이 등록되어 있음)`,
          })
        }

        console.log('상품 등록 시도:', productsToInsert.length, '개')
        console.log('등록할 상품 데이터 샘플:', JSON.stringify(productsToInsert[0], null, 2))
        
        // 각 상품을 개별적으로 등록 (일부 실패해도 나머지는 등록되도록)
        const insertErrors: any[] = []
        
        for (let i = 0; i < productsToInsert.length; i++) {
          const product = productsToInsert[i]
          console.log(`[${i + 1}/${productsToInsert.length}] 상품 등록 시도:`, product.product_name)
          
          const { data: insertedData, error: insertError } = await supabase
            .from('products')
            .insert(product)
            .select()
            .single()

          if (insertError) {
            console.error(`[${i + 1}/${productsToInsert.length}] 개별 상품 등록 오류:`, {
              product_name: product.product_name,
              product_data: product,
              error: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
              code: insertError.code,
            })
            insertErrors.push({
              product_name: product.product_name,
              error: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
            })
          } else {
            console.log(`[${i + 1}/${productsToInsert.length}] 상품 등록 성공:`, {
              product_name: product.product_name,
              id: insertedData?.id,
              status: insertedData?.status,
            })
            if (insertedData) {
              insertResults.push(insertedData)
            }
          }
        }

        if (insertErrors.length > 0) {
          console.warn('일부 상품 등록 실패:', insertErrors.length, '개')
          // 일부라도 성공했으면 성공으로 처리
          if (insertResults.length > 0) {
            return NextResponse.json({
              success: true,
              message: `판매 요청이 승인되었습니다. (${insertResults.length}개 상품 등록 성공, ${insertErrors.length}개 실패)`,
              warning: insertErrors.length > 0 ? `${insertErrors.length}개 상품 등록 실패` : undefined,
              errors: insertErrors,
              insertedCount: insertResults.length,
            })
          } else {
            // 모두 실패한 경우
            return NextResponse.json({
              success: true,
              warning: '상태는 업데이트되었지만 모든 상품 등록에 실패했습니다.',
              errors: insertErrors,
              insertedCount: 0,
            })
          }
        }

        console.log('모든 상품 등록 성공:', insertResults.length, '개')
        
        // 등록된 상품 ID 확인
        if (insertResults.length > 0) {
          const insertedIds = insertResults.map(r => r.id)
          console.log('등록된 상품 ID:', insertedIds)
          
          // 등록 확인을 위해 다시 조회
          const { data: verifyProducts } = await supabase
            .from('products')
            .select('id, product_name, status')
            .in('id', insertedIds)
          
          console.log('등록 확인 조회 결과:', verifyProducts?.length || 0, '개')
          if (verifyProducts) {
            verifyProducts.forEach(p => {
              console.log(`  - ${p.product_name}: status=${p.status}, id=${p.id}`)
            })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `판매 요청이 ${status === 'approved' ? '승인' : '거부'}되었습니다.`,
      insertedCount: insertResults.length,
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


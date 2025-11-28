import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { SalesListItem } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const { sellerId, items } = await request.json()

    if (!sellerId || !items || !Array.isArray(items) || items.length === 0) {
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

    // 유효성 검사
    for (const item of items) {
      if (!item.product_name || !item.selling_price || item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: '모든 필수 항목을 입력해주세요.' },
          { status: 400 }
        )
      }
    }

    // 판매 리스트 생성 (자동 승인)
    const { data: salesList, error: insertError } = await supabase
      .from('sales_lists')
      .insert({
        seller_id: sellerId,
        items: items,
        status: 'approved', // 자동 승인
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError || !salesList) {
      console.error('판매 리스트 생성 오류:', insertError)
      return NextResponse.json(
        { success: false, error: `판매 리스트 생성에 실패했습니다: ${insertError?.message || '알 수 없는 오류'}` },
        { status: 500 }
      )
    }

    console.log('✅ 판매 리스트 생성 성공:', salesList.id)

    // 자동으로 products 테이블에 상품 등록
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
          sales_list_id: salesList.id,
          seller_id: sellerId,
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
        warning: '판매 리스트는 생성되었지만 등록할 수 있는 유효한 상품이 없습니다.',
        salesListId: salesList.id,
      })
    }

    console.log('상품 등록 시도:', productsToInsert.length, '개')
    
    // 각 상품을 개별적으로 등록 (일부 실패해도 나머지는 등록되도록)
    const insertResults: any[] = []
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
          error: insertError.message,
        })
        insertErrors.push({
          product_name: product.product_name,
          error: insertError.message,
        })
      } else {
        console.log(`[${i + 1}/${productsToInsert.length}] 상품 등록 성공:`, {
          product_name: product.product_name,
          id: insertedData?.id,
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
          message: `판매 리스트가 생성되었습니다. (${insertResults.length}개 상품 등록 성공, ${insertErrors.length}개 실패)`,
          warning: insertErrors.length > 0 ? `${insertErrors.length}개 상품 등록 실패` : undefined,
          errors: insertErrors,
          insertedCount: insertResults.length,
          salesListId: salesList.id,
        })
      } else {
        // 모두 실패한 경우
        return NextResponse.json({
          success: true,
          warning: '판매 리스트는 생성되었지만 모든 상품 등록에 실패했습니다.',
          errors: insertErrors,
          insertedCount: 0,
          salesListId: salesList.id,
        })
      }
    }

    console.log('모든 상품 등록 성공:', insertResults.length, '개')

    return NextResponse.json({
      success: true,
      message: `판매 리스트가 생성되었고 ${insertResults.length}개 상품이 등록되었습니다.`,
      insertedCount: insertResults.length,
      salesListId: salesList.id,
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { salesListId, userId } = await request.json()

    if (!salesListId || !userId) {
      return NextResponse.json(
        { success: false, error: '판매 리스트 ID와 사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 판매 리스트 조회 및 소유자 확인
    const { data: salesList, error: fetchError } = await supabase
      .from('sales_lists')
      .select('id, seller_id, status')
      .eq('id', salesListId)
      .single()

    if (fetchError || !salesList) {
      console.error('판매 리스트 조회 오류:', fetchError)
      return NextResponse.json(
        { success: false, error: '판매 리스트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 소유자 확인
    if (salesList.seller_id !== userId) {
      return NextResponse.json(
        { success: false, error: '판매 리스트를 삭제할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 승인된 판매 리스트의 경우 관련 products 확인 및 삭제
    if (salesList.status === 'approved') {
      // 관련 products 확인 (판매 완료된 제품 제외)
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, status')
        .eq('sales_list_id', salesListId)

      if (productsError) {
        console.error('관련 상품 조회 오류:', productsError)
        return NextResponse.json(
          { success: false, error: `상품 조회 실패: ${productsError.message}` },
          { status: 500 }
        )
      }

      if (allProducts && allProducts.length > 0) {
        // 판매 완료된 제품과 활성 제품 분리
        const soldProducts = allProducts.filter((p: any) => p.status === 'sold')
        const activeProducts = allProducts.filter((p: any) => p.status !== 'sold')

        console.log(`📦 총 상품: ${allProducts.length}개 (판매 완료: ${soldProducts.length}개, 활성: ${activeProducts.length}개)`)

        // 활성 제품이 있는 경우에만 삭제 처리
        if (activeProducts.length > 0) {
          const activeProductIds = activeProducts.map((p: any) => p.id)

          // 활성 제품에 대한 진행 중인 구매 요청 확인
          const { data: purchaseRequests, error: prError } = await supabase
            .from('purchase_requests')
            .select('id, status, product_id')
            .in('product_id', activeProductIds)
            .in('status', ['pending', 'confirmed', 'approved'])

          if (prError) {
            console.error('구매 요청 조회 오류:', prError)
            return NextResponse.json(
              { success: false, error: `구매 요청 조회 실패: ${prError.message}` },
              { status: 500 }
            )
          }

          // 진행 중인 구매 요청이 있는 경우 삭제 불가
          if (purchaseRequests && purchaseRequests.length > 0) {
            return NextResponse.json(
              { 
                success: false, 
                error: `진행 중인 구매 요청이 ${purchaseRequests.length}개 있어 삭제할 수 없습니다. 구매 요청을 취소하거나 완료한 후 삭제해주세요.` 
              },
              { status: 400 }
            )
          }

          // 활성 제품만 삭제 (판매 완료된 제품은 유지)
          const { error: deleteProductsError } = await supabase
            .from('products')
            .delete()
            .in('id', activeProductIds)

          if (deleteProductsError) {
            console.error('상품 삭제 오류:', deleteProductsError)
            return NextResponse.json(
              { success: false, error: `상품 삭제 실패: ${deleteProductsError.message}` },
              { status: 500 }
            )
          }

          console.log(`✅ 활성 상품 ${activeProducts.length}개 삭제 성공 (판매 완료 ${soldProducts.length}개는 유지)`)
        } else {
          console.log('⚠️ 삭제할 활성 상품이 없습니다 (모든 상품이 판매 완료됨)')
        }

        // 판매 완료된 제품의 sales_list_id를 NULL로 설정 (판매 리스트 삭제 후에도 제품 유지)
        if (soldProducts.length > 0) {
          const soldProductIds = soldProducts.map((p: any) => p.id)
          const { error: updateError } = await supabase
            .from('products')
            .update({ sales_list_id: null })
            .in('id', soldProductIds)

          if (updateError) {
            console.error('판매 완료 제품 업데이트 오류:', updateError)
            // 에러가 발생해도 판매 리스트 삭제는 계속 진행
          } else {
            console.log(`✅ 판매 완료 제품 ${soldProducts.length}개의 sales_list_id를 NULL로 설정`)
          }
        }
      }
    }

    // 판매 리스트 삭제
    const { error: deleteError } = await supabase
      .from('sales_lists')
      .delete()
      .eq('id', salesListId)

    if (deleteError) {
      console.error('판매 리스트 삭제 오류:', deleteError)
      return NextResponse.json(
        { success: false, error: `판매 리스트 삭제 실패: ${deleteError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 판매 리스트 삭제 성공:', salesListId)

    return NextResponse.json({
      success: true,
      message: '판매 리스트가 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


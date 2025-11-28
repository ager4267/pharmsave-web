import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 판매 리스트 일괄 삭제 API
 * 거부된 판매 리스트 또는 판매 완료된 제품이 있는 판매 리스트를 일괄 삭제
 */
export async function POST(request: Request) {
  try {
    const { salesListIds, adminUserId } = await request.json()

    if (!salesListIds || !Array.isArray(salesListIds) || salesListIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 판매 리스트 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!adminUserId) {
      return NextResponse.json(
        { success: false, error: '관리자 ID가 필요합니다.' },
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
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    // 판매 리스트 조회
    const { data: salesLists, error: salesListsError } = await supabase
      .from('sales_lists')
      .select('id, status')
      .in('id', salesListIds)

    if (salesListsError || !salesLists || salesLists.length === 0) {
      return NextResponse.json(
        { success: false, error: '판매 리스트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 삭제 가능한 판매 리스트와 삭제 불가능한 판매 리스트 분류
    const deletableLists: string[] = []
    const skippedLists: string[] = []
    const errors: string[] = []

    for (const list of salesLists) {
      // pending 상태는 삭제 불가
      if (list.status === 'pending') {
        skippedLists.push(list.id)
        errors.push(`판매 리스트 ${list.id}: 대기 중인 판매 리스트는 삭제할 수 없습니다.`)
        continue
      }

      // rejected 상태는 바로 삭제 가능
      if (list.status === 'rejected') {
        deletableLists.push(list.id)
        continue
      }

      // approved 상태의 경우, 관련 products 확인
      if (list.status === 'approved') {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, status')
          .eq('sales_list_id', list.id)

        if (productsError) {
          skippedLists.push(list.id)
          errors.push(`판매 리스트 ${list.id}: 상품 조회 실패`)
          continue
        }

        // products가 없으면 삭제 가능
        if (!products || products.length === 0) {
          deletableLists.push(list.id)
          continue
        }

        // 모든 products가 'sold' 상태인지 확인
        const allSold = products.every((p: any) => p.status === 'sold')
        
        if (!allSold) {
          skippedLists.push(list.id)
          const activeCount = products.filter((p: any) => p.status === 'active').length
          errors.push(`판매 리스트 ${list.id}: 판매 완료되지 않은 상품이 ${activeCount}개 있습니다.`)
          continue
        }

        // 승인된 구매 요청 확인
        const productIds = products.map((p: any) => p.id)
        const { data: purchaseRequests } = await supabase
          .from('purchase_requests')
          .select('id, status')
          .in('product_id', productIds)

        const approvedRequests = purchaseRequests?.filter((pr: any) => pr.status === 'approved') || []
        if (approvedRequests.length > 0) {
          skippedLists.push(list.id)
          errors.push(`판매 리스트 ${list.id}: 승인된 구매 요청이 ${approvedRequests.length}개 있습니다.`)
          continue
        }

        // 삭제 가능
        deletableLists.push(list.id)
      }
    }

    if (deletableLists.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '삭제 가능한 판매 리스트가 없습니다.',
          errors: errors
        },
        { status: 400 }
      )
    }

    // 삭제 가능한 판매 리스트의 products 조회 및 삭제
    const { data: allProducts, error: allProductsError } = await supabase
      .from('products')
      .select('id, sales_list_id')
      .in('sales_list_id', deletableLists)

    if (allProductsError) {
      console.error('상품 조회 오류:', allProductsError)
    }

    const productIdsToDelete = allProducts?.map((p: any) => p.id) || []

    // products 삭제 (있는 경우)
    if (productIdsToDelete.length > 0) {
      const { error: deleteProductsError } = await supabase
        .from('products')
        .delete()
        .in('id', productIdsToDelete)

      if (deleteProductsError) {
        console.error('상품 삭제 오류:', deleteProductsError)
        // products 삭제 실패해도 sales_lists는 삭제 시도
      } else {
        console.log(`✅ ${productIdsToDelete.length}개의 상품이 삭제되었습니다.`)
      }
    }

    // 판매 리스트 삭제
    const { error: deleteError } = await supabase
      .from('sales_lists')
      .delete()
      .in('id', deletableLists)

    if (deleteError) {
      console.error('판매 리스트 일괄 삭제 오류:', deleteError)
      return NextResponse.json(
        { success: false, error: `판매 리스트 삭제 실패: ${deleteError.message}` },
        { status: 500 }
      )
    }

    const deletedCount = deletableLists.length
    const skippedCount = skippedLists.length
    const deletedProductsCount = productIdsToDelete.length

    console.log('✅ 판매 리스트 일괄 삭제 성공:', { deletedCount, skippedCount, deletedProductsCount })

    let message = `${deletedCount}개의 판매 리스트가 삭제되었습니다.`
    if (deletedProductsCount > 0) {
      message += ` (관련 상품 ${deletedProductsCount}개도 함께 삭제됨)`
    }
    if (skippedCount > 0) {
      message += ` (${skippedCount}개는 삭제 조건을 만족하지 않아 건너뜀)`
    }

    return NextResponse.json({
      success: true,
      message,
      deletedCount,
      skippedCount,
      deletedProductsCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


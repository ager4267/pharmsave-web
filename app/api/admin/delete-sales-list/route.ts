import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 판매 리스트 삭제 API
 * 거부된 판매 리스트 또는 판매 완료된 제품이 있는 판매 리스트를 삭제
 */
export async function POST(request: Request) {
  try {
    const { salesListId, adminUserId } = await request.json()

    if (!salesListId || !adminUserId) {
      return NextResponse.json(
        { success: false, error: '판매 리스트 ID와 관리자 ID가 필요합니다.' },
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

    // 판매 리스트 확인
    const { data: salesList, error: salesListError } = await supabase
      .from('sales_lists')
      .select('id, status')
      .eq('id', salesListId)
      .single()

    if (salesListError || !salesList) {
      return NextResponse.json(
        { success: false, error: '판매 리스트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 거부된 판매 리스트는 바로 삭제 가능
    if (salesList.status === 'rejected') {
      // 관련된 products가 있는지 확인 (있어도 삭제 가능)
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

      return NextResponse.json({
        success: true,
        message: '거부된 판매 리스트가 삭제되었습니다.',
      })
    }

    // 승인된 판매 리스트의 경우, 관련 products 확인
    if (salesList.status === 'approved') {
      // 해당 판매 리스트로 생성된 products 조회
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, status')
        .eq('sales_list_id', salesListId)

      if (productsError) {
        console.error('상품 조회 오류:', productsError)
        return NextResponse.json(
          { success: false, error: `상품 조회 실패: ${productsError.message}` },
          { status: 500 }
        )
      }

      // products가 없는 경우 (아직 생성되지 않음) - 삭제 가능
      if (!products || products.length === 0) {
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

        return NextResponse.json({
          success: true,
          message: '판매 리스트가 삭제되었습니다.',
        })
      }

      // 모든 products가 'sold' 상태인지 확인
      const allSold = products.every((p: any) => p.status === 'sold')
      
      if (!allSold) {
        const activeCount = products.filter((p: any) => p.status === 'active').length
        return NextResponse.json(
          { 
            success: false, 
            error: `판매 완료되지 않은 상품이 ${activeCount}개 있어 삭제할 수 없습니다. 모든 상품이 판매 완료된 후 삭제 가능합니다.` 
          },
          { status: 400 }
        )
      }

      // 모든 products가 'sold' 상태인 경우 - products와 sales_list 모두 삭제
      const productIds = products.map((p: any) => p.id)
      
      // 1. 관련 purchase_requests 확인 (approved인 경우 삭제 불가)
      const { data: purchaseRequests, error: prError } = await supabase
        .from('purchase_requests')
        .select('id, status')
        .in('product_id', productIds)

      if (prError) {
        console.error('구매 요청 조회 오류:', prError)
      }

      const approvedRequests = purchaseRequests?.filter((pr: any) => pr.status === 'approved') || []
      if (approvedRequests.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `승인된 구매 요청이 ${approvedRequests.length}개 있어 삭제할 수 없습니다.` 
          },
          { status: 400 }
        )
      }

      // 2. products 삭제
      const { error: deleteProductsError } = await supabase
        .from('products')
        .delete()
        .in('id', productIds)

      if (deleteProductsError) {
        console.error('상품 삭제 오류:', deleteProductsError)
        return NextResponse.json(
          { success: false, error: `상품 삭제 실패: ${deleteProductsError.message}` },
          { status: 500 }
        )
      }

      // 3. sales_list 삭제
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

      return NextResponse.json({
        success: true,
        message: `판매 완료된 판매 리스트와 관련 상품 ${products.length}개가 삭제되었습니다.`,
        deletedProductsCount: products.length,
      })
    }

    // pending 상태는 삭제 불가 (승인/거부 후 삭제 가능)
    return NextResponse.json(
      { success: false, error: '대기 중인 판매 리스트는 삭제할 수 없습니다. 먼저 승인 또는 거부해주세요.' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'

// 동적 렌더링 강제 (request.cookies 사용으로 인해 필요)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createRouteHandlerClient(request, NextResponse.next())
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
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
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 사용자 프로필 확인
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: '프로필을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 관리자는 접근 불가
    if (profile.role === 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자는 이 API를 사용할 수 없습니다.' },
        { status: 403 }
      )
    }

    // 판매자의 상품 ID 목록 조회
    const { data: myProducts, error: productsError } = await adminSupabase
      .from('products')
      .select('id, product_name, seller_id')
      .eq('seller_id', user.id)

    if (productsError) {
      console.error('❌ 상품 조회 오류:', productsError)
      return NextResponse.json(
        { success: false, error: '상품 정보를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    console.log('📦 판매자 상품 조회:', {
      seller_id: user.id,
      product_count: myProducts?.length || 0,
      products: myProducts?.map(p => ({ id: p.id, name: p.product_name }))
    })

    if (!myProducts || myProducts.length === 0) {
      console.log('⚠️ 판매자의 상품이 없습니다.')
      return NextResponse.json({
        success: true,
        purchaseRequests: [],
        message: '판매자의 상품이 없습니다.'
      })
    }

    const productIds = myProducts.map(p => p.id)
    console.log('🔍 조회할 상품 ID 목록:', productIds)

    // 구매 요청 조회
    const { data: requests, error: requestsError } = await adminSupabase
      .from('purchase_requests')
      .select(`
        *,
        profiles:profiles!purchase_requests_buyer_id_fkey(email, company_name),
        products:products!purchase_requests_product_id_fkey(product_name, selling_price)
      `)
      .in('product_id', productIds)
      .order('requested_at', { ascending: false })

    console.log('📋 구매 요청 조회 결과:', {
      count: requests?.length || 0,
      requests: requests?.map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        buyer_id: r.buyer_id,
        status: r.status,
        quantity: r.quantity,
      }))
    })

    if (requestsError) {
      console.error('❌ 구매 요청 조회 오류:', requestsError)
      return NextResponse.json(
        { success: false, error: '구매 요청을 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // products가 배열인 경우 첫 번째 요소 사용
    const processedData = (requests || []).map((req: any) => ({
      ...req,
      product_name: Array.isArray(req.products) 
        ? req.products[0]?.product_name 
        : req.products?.product_name || '-',
      selling_price: Array.isArray(req.products) 
        ? req.products[0]?.selling_price 
        : req.products?.selling_price || 0,
    }))

    return NextResponse.json({
      success: true,
      purchaseRequests: processedData,
    })
  } catch (error: any) {
    console.error('❌ 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


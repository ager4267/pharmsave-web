import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'

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

    // 구매자가 자신의 구매 요청 조회
    const { data: requests, error: requestsError } = await adminSupabase
      .from('purchase_requests')
      .select(`
        *,
        products:products!purchase_requests_product_id_fkey(
          id,
          product_name,
          selling_price,
          quantity,
          expiry_date,
          seller:profiles!products_seller_id_fkey(company_name, email)
        )
      `)
      .eq('buyer_id', user.id)
      .order('requested_at', { ascending: false })

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
      seller_company: Array.isArray(req.products) 
        ? req.products[0]?.seller?.company_name 
        : req.products?.seller?.company_name || '-',
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


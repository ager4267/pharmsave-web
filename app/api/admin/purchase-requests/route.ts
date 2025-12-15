import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'

// 동적 렌더링 강제 (request.cookies 사용으로 인해 필요)
export const dynamic = 'force-dynamic'

/**
 * 관리자 구매요청 목록 조회 API
 * GET /api/admin/purchase-requests
 */
export async function GET(request: NextRequest) {
  const response = new NextResponse()
  
  try {
    const supabase = createRouteHandlerClient(request, response)
    
    if (!supabase || !supabase.auth) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
      return NextResponse.json(
        { success: false, error: '서버 설정 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
    
    // 관리자 권한 확인
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }
    
    // 필터 파라미터 확인
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || 'all'
    
    // 구매요청 조회 (Service Role 사용)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }
    
    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    let query = adminSupabase
      .from('purchase_requests')
      .select(`
        id,
        buyer_id,
        product_id,
        quantity,
        unit_price,
        total_price,
        shipping_address,
        status,
        requested_at,
        reviewed_at,
        reviewed_by,
        notes,
        buyer:profiles!purchase_requests_buyer_id_fkey(id, email, company_name),
        product:products!purchase_requests_product_id_fkey(
          id,
          product_name,
          seller_id,
          seller:profiles!products_seller_id_fkey(id, email, company_name)
        )
      `)
      .order('requested_at', { ascending: false })
    
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('❌ 구매요청 조회 오류:', error)
      return NextResponse.json(
        { success: false, error: '구매요청 조회에 실패했습니다.' },
        { status: 500 }
      )
    }
    
    // 데이터 처리
    const processedData = (data || []).map((req: any) => ({
      ...req,
      product_name: req.product?.product_name || '-',
      seller: req.product?.seller || null,
      buyer: req.buyer || null,
    }))
    
    const jsonResponse = NextResponse.json({
      success: true,
      data: processedData
    })
    
    // 쿠키를 응답에 포함
    response.cookies.getAll().forEach(cookie => {
      jsonResponse.cookies.set(cookie.name, cookie.value)
    })
    
    return jsonResponse
  } catch (error: any) {
    console.error('❌ 구매요청 조회 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


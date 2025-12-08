import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 동적 렌더링 강제 (request.url 사용으로 인해 필요)
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('seller_id')
    const status = searchParams.get('status')

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

    let query = supabase
      .from('sales_approval_reports')
      .select(`
        id,
        report_number,
        seller_id,
        buyer_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_amount,
        commission,
        status,
        created_at,
        sent_at,
        confirmed_at,
        shipped_at,
        completed_at,
        tracking_number,
        shipping_address,
        notes,
        buyer_info_revealed,
        points_deducted,
        seller:profiles!sales_approval_reports_seller_id_fkey(id, email, company_name),
        buyer:profiles!sales_approval_reports_buyer_id_fkey(id, email, company_name),
        product:products!sales_approval_reports_product_id_fkey(id, product_name, specification, manufacturer)
      `)
      .order('created_at', { ascending: false })

    if (sellerId) {
      query = query.eq('seller_id', sellerId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('판매 승인 보고서 조회 오류:', error)
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reports: data || [],
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


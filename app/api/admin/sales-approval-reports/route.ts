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
      console.log('🔍 판매 승인 보고서 조회 - sellerId 필터:', sellerId)
      
      // seller_id 유효성 확인
      if (!sellerId || typeof sellerId !== 'string') {
        console.error('❌ seller_id가 유효하지 않습니다:', sellerId)
        return NextResponse.json(
          { success: false, error: '판매자 ID가 유효하지 않습니다.' },
          { status: 400 }
        )
      }
      
      // 디버깅: seller_id로 조회 가능한 모든 보고서 확인 (Service Role로 직접 조회)
      const { data: allReports, error: allError } = await supabase
        .from('sales_approval_reports')
        .select('id, report_number, seller_id, status, created_at, sent_at')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })
      
      console.log('🔍 seller_id로 조회된 모든 보고서 (Service Role):', {
        sellerId: sellerId,
        count: allReports?.length || 0,
        reports: allReports?.map((r: any) => ({
          id: r.id,
          reportNumber: r.report_number,
          sellerId: r.seller_id,
          status: r.status,
          createdAt: r.created_at,
          sentAt: r.sent_at,
        })) || [],
        error: allError,
      })
      
      // seller_id가 실제로 존재하는지 확인 (maybeSingle 사용 - 없어도 오류 발생 안 함)
      const { data: sellerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, company_name, role')
        .eq('id', sellerId)
        .maybeSingle()
      
      if (profileError) {
        console.error('❌ 판매자 프로필 조회 오류:', profileError)
      } else if (!sellerProfile) {
        console.warn('⚠️ 판매자 프로필이 존재하지 않습니다:', sellerId)
      } else {
        console.log('✅ 판매자 프로필 확인:', {
          sellerId: sellerId,
          email: sellerProfile.email,
          companyName: sellerProfile.company_name,
          role: sellerProfile.role,
        })
      }
    }

    if (status) {
      query = query.eq('status', status)
      console.log('🔍 판매 승인 보고서 조회 - status 필터:', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ 판매 승인 보고서 조회 오류:', error)
      console.error('❌ 오류 상세:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('✅ 판매 승인 보고서 조회 성공:', {
      sellerId: sellerId || '전체',
      status: status || '전체',
      count: data?.length || 0,
      reports: data?.map((r: any) => ({
        id: r.id,
        reportNumber: r.report_number,
        sellerId: r.seller_id,
        status: r.status,
        sentAt: r.sent_at,
      })) || [],
    })

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


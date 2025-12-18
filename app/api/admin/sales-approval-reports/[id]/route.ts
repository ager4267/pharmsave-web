import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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

    const { data, error } = await supabase
      .from('sales_approval_reports')
      .select(`
        *,
        seller:profiles!sales_approval_reports_seller_id_fkey(id, email, company_name, phone_number, address, business_number),
        buyer:profiles!sales_approval_reports_buyer_id_fkey(id, email, company_name, phone_number, address, business_number),
        product:products!sales_approval_reports_product_id_fkey(id, product_name, specification, manufacturer, expiry_date),
        purchase_request:purchase_requests!sales_approval_reports_purchase_request_id_fkey(id, requested_at, notes)
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('판매 승인 보고서 조회 오류:', error)
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      report: data,
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { action, tracking_number, notes } = await request.json()

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

    const updateData: any = {}

    if (action === 'send') {
      updateData.status = 'sent'
      updateData.sent_at = new Date().toISOString()
    } else if (action === 'confirm') {
      updateData.status = 'confirmed'
      updateData.confirmed_at = new Date().toISOString()
    } else if (action === 'ship') {
      updateData.status = 'shipped'
      updateData.shipped_at = new Date().toISOString()
      if (tracking_number) {
        updateData.tracking_number = tracking_number
      }
    } else if (action === 'complete') {
      updateData.status = 'completed'
      updateData.completed_at = new Date().toISOString()
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    const { data, error } = await supabase
      .from('sales_approval_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('판매 승인 보고서 업데이트 오류:', error)
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '판매 승인 보고서가 업데이트되었습니다.',
      report: data,
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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

    // 보고서 존재 여부 확인
    const { data: existingReport, error: fetchError } = await supabase
      .from('sales_approval_reports')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('판매 승인 보고서 조회 오류:', fetchError)
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서를 조회하는 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!existingReport) {
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 보고서 삭제
    const { error: deleteError } = await supabase
      .from('sales_approval_reports')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('판매 승인 보고서 삭제 오류:', deleteError)
      return NextResponse.json(
        { success: false, error: '판매 승인 보고서 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '판매 승인 보고서가 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


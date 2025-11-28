import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 관리자 포인트 충전 요청 승인/거부 API
 * POST /api/admin/point-charge-requests/[id]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Service Role 클라이언트 생성 (RLS 정책 우회)
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

    // 요청 본문에서 관리자 ID 가져오기
    const body = await request.json()
    const { action, adminNotes, adminUserId } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: '유효한 액션이 필요합니다. (approve 또는 reject)' },
        { status: 400 }
      )
    }

    if (!adminUserId) {
      return NextResponse.json(
        { success: false, error: '관리자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 관리자 권한 확인
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: '유효한 액션이 필요합니다. (approve 또는 reject)' },
        { status: 400 }
      )
    }

    const requestId = params.id

    // 포인트 충전 요청 조회
    const { data: chargeRequest, error: requestError } = await supabase
      .from('point_charge_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (requestError || !chargeRequest) {
      return NextResponse.json(
        { success: false, error: '포인트 충전 요청을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (chargeRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `이미 처리된 요청입니다. (현재 상태: ${chargeRequest.status})` },
        { status: 400 }
      )
    }

    let result: any

    if (action === 'approve') {
      // 승인 함수 호출
      const { data: approveResult, error: approveError } = await supabase.rpc(
        'approve_point_charge_request',
        {
          p_request_id: requestId,
          p_admin_user_id: adminUserId,
          p_admin_notes: adminNotes || null
        }
      )

      if (approveError || !approveResult || !approveResult.success) {
        console.error('❌ 포인트 충전 요청 승인 실패:', approveError || approveResult?.error)
        return NextResponse.json(
          { 
            success: false, 
            error: approveResult?.error || approveError?.message || '포인트 충전 요청 승인에 실패했습니다.' 
          },
          { status: 500 }
        )
      }

      result = approveResult
      console.log('✅ 포인트 충전 요청 승인 성공:', {
        requestId,
        userId: chargeRequest.user_id,
        amount: chargeRequest.requested_amount,
        points: chargeRequest.requested_points
      })
    } else {
      // 거부 함수 호출
      const { data: rejectResult, error: rejectError } = await supabase.rpc(
        'reject_point_charge_request',
        {
          p_request_id: requestId,
          p_admin_user_id: adminUserId,
          p_admin_notes: adminNotes || null
        }
      )

      if (rejectError || !rejectResult || !rejectResult.success) {
        console.error('❌ 포인트 충전 요청 거부 실패:', rejectError || rejectResult?.error)
        return NextResponse.json(
          { 
            success: false, 
            error: rejectResult?.error || rejectError?.message || '포인트 충전 요청 거부에 실패했습니다.' 
          },
          { status: 500 }
        )
      }

      result = rejectResult
      console.log('✅ 포인트 충전 요청 거부 성공:', {
        requestId,
        userId: chargeRequest.user_id
      })
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('❌ 포인트 충전 요청 처리 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


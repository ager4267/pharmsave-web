import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 관리자 구매요청 삭제 API
 * DELETE /api/admin/delete-purchase-request
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient(request, NextResponse.next())
    
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
    
    // 요청 본문에서 purchaseRequestId 가져오기
    const { purchaseRequestId } = await request.json()
    
    if (!purchaseRequestId) {
      return NextResponse.json(
        { success: false, error: '구매 요청 ID가 필요합니다.' },
        { status: 400 }
      )
    }
    
    // Service Role 클라이언트 생성
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }
    
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // 구매 요청 존재 확인
    const { data: purchaseRequest, error: fetchError } = await adminSupabase
      .from('purchase_requests')
      .select('id, status')
      .eq('id', purchaseRequestId)
      .single()
    
    if (fetchError || !purchaseRequest) {
      return NextResponse.json(
        { success: false, error: '구매 요청을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    // 구매 요청 삭제
    const { error: deleteError } = await adminSupabase
      .from('purchase_requests')
      .delete()
      .eq('id', purchaseRequestId)
    
    if (deleteError) {
      console.error('❌ 구매 요청 삭제 오류:', deleteError)
      return NextResponse.json(
        { success: false, error: '구매 요청 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }
    
    console.log('✅ 구매 요청 삭제 성공:', purchaseRequestId)
    
    return NextResponse.json({
      success: true,
      message: '구매 요청이 삭제되었습니다.',
    })
  } catch (error: any) {
    console.error('❌ 구매 요청 삭제 API 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}











/**
 * 테스트 데이터 초기화 스크립트
 * 관리자를 제외한 모든 사용자 데이터를 삭제합니다.
 * 
 * 사용법: node scripts/reset-test-data.js
 * 
 * 주의: 이 스크립트는 프로덕션 환경에서 사용하면 안 됩니다!
 */

const { createClient } = require('@supabase/supabase-js')

// 환경 변수 로드 (dotenv가 있으면 사용, 없으면 process.env 직접 사용)
try {
  require('dotenv').config({ path: '.env.local' })
} catch (e) {
  // dotenv가 없어도 계속 진행 (환경 변수는 이미 설정되어 있을 수 있음)
}

// 환경 변수 확인 및 입력 요청
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 오류: 환경 변수가 설정되지 않았습니다.')
  console.error('\n필요한 환경 변수:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  console.error('\n다음 방법 중 하나를 사용하세요:')
  console.error('1. .env.local 파일 생성:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  console.error('\n2. 환경 변수로 직접 설정:')
  console.error('   $env:NEXT_PUBLIC_SUPABASE_URL="your_url"; $env:SUPABASE_SERVICE_ROLE_KEY="your_key"; node scripts/reset-test-data.js')
  console.error('\n3. Supabase Dashboard에서 확인:')
  console.error('   - Settings → API → Project URL')
  console.error('   - Settings → API → service_role key (secret)')
  console.error('\n⚠️  Service Role Key는 절대 공개되면 안 되는 비밀 키입니다!')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

async function resetTestData() {
  console.log('🔄 테스트 데이터 초기화를 시작합니다...\n')

  try {
    // 1. 관리자 ID 목록 조회
    console.log('📋 관리자 계정 확인 중...')
    const { data: adminProfiles, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, company_name')
      .eq('role', 'admin')

    if (adminError) {
      throw new Error(`관리자 조회 실패: ${adminError.message}`)
    }

    const adminIds = adminProfiles?.map(p => p.id) || []

    if (adminIds.length === 0) {
      console.error('❌ 관리자 계정을 찾을 수 없습니다. 초기화를 중단합니다.')
      process.exit(1)
    }

    console.log(`✅ 관리자 계정 ${adminIds.length}개 확인됨:`)
    adminProfiles?.forEach(admin => {
      console.log(`   - ${admin.email} (${admin.company_name || 'N/A'})`)
    })
    console.log()

    // 2. 관리자가 아닌 사용자 ID 목록 조회
    console.log('📋 삭제 대상 사용자 확인 중...')
    const { data: nonAdminProfiles, error: nonAdminError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, company_name')
      .neq('role', 'admin')

    if (nonAdminError) {
      throw new Error(`사용자 조회 실패: ${nonAdminError.message}`)
    }

    const nonAdminIds = nonAdminProfiles?.map(p => p.id) || []

    if (nonAdminIds.length === 0) {
      console.log('ℹ️  삭제할 데이터가 없습니다.')
      return
    }

    console.log(`⚠️  삭제 대상 사용자 ${nonAdminIds.length}개:`)
    nonAdminProfiles?.forEach(user => {
      console.log(`   - ${user.email} (${user.company_name || 'N/A'})`)
    })
    console.log()

    // 3. 확인 메시지
    console.log('⚠️  경고: 다음 데이터가 삭제됩니다:')
    console.log('   - 사용자 프로필 (관리자 제외)')
    console.log('   - 판매 리스트, 상품, 구매 요청 등 모든 관련 데이터')
    console.log('   - 포인트 및 거래 내역')
    console.log('   - 재고 분석 데이터')
    console.log()
    console.log('이 작업은 되돌릴 수 없습니다!')
    console.log()

    // 4. 데이터 삭제
    const deletionResults = {}

    console.log('🗑️  데이터 삭제 중...\n')

    // 4-1. 포인트 충전 요청
    const { count: chargeRequestsCount } = await supabaseAdmin
      .from('point_charge_requests')
      .delete()
      .in('user_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.point_charge_requests = chargeRequestsCount || 0
    console.log(`   ✓ 포인트 충전 요청: ${deletionResults.point_charge_requests}개 삭제`)

    // 4-2. 포인트 거래 내역
    const { count: transactionsCount } = await supabaseAdmin
      .from('point_transactions')
      .delete()
      .in('user_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.point_transactions = transactionsCount || 0
    console.log(`   ✓ 포인트 거래 내역: ${deletionResults.point_transactions}개 삭제`)

    // 4-3. 포인트 잔액
    const { count: pointsCount } = await supabaseAdmin
      .from('points')
      .delete()
      .in('user_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.points = pointsCount || 0
    console.log(`   ✓ 포인트 잔액: ${deletionResults.points}개 삭제`)

    // 4-4. 판매 승인 보고서
    const { count: reportsCount1 } = await supabaseAdmin
      .from('sales_approval_reports')
      .delete()
      .in('seller_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    
    const { count: reportsCount2 } = await supabaseAdmin
      .from('sales_approval_reports')
      .delete()
      .in('buyer_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    
    deletionResults.sales_approval_reports = (reportsCount1 || 0) + (reportsCount2 || 0)
    console.log(`   ✓ 판매 승인 보고서: ${deletionResults.sales_approval_reports}개 삭제`)

    // 4-5. 재판매
    const { count: resalesCount } = await supabaseAdmin
      .from('resales')
      .delete()
      .in('buyer_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.resales = resalesCount || 0
    console.log(`   ✓ 재판매: ${deletionResults.resales}개 삭제`)

    // 4-6. 결제
    const { data: nonAdminPurchaseRequests } = await supabaseAdmin
      .from('purchase_requests')
      .select('id')
      .in('buyer_id', nonAdminIds)

    const { data: nonAdminPurchaseOrders } = await supabaseAdmin
      .from('purchase_orders')
      .select('id')
      .in('seller_id', nonAdminIds)

    const nonAdminPrIds = nonAdminPurchaseRequests?.map(pr => pr.id) || []
    const nonAdminPoIds = nonAdminPurchaseOrders?.map(po => po.id) || []

    if (nonAdminPrIds.length > 0 || nonAdminPoIds.length > 0) {
      let paymentsQuery = supabaseAdmin.from('payments').delete()
      
      if (nonAdminPrIds.length > 0 && nonAdminPoIds.length > 0) {
        paymentsQuery = paymentsQuery.or(`purchase_request_id.in.(${nonAdminPrIds.join(',')}),purchase_order_id.in.(${nonAdminPoIds.join(',')})`)
      } else if (nonAdminPrIds.length > 0) {
        paymentsQuery = paymentsQuery.in('purchase_request_id', nonAdminPrIds)
      } else {
        paymentsQuery = paymentsQuery.in('purchase_order_id', nonAdminPoIds)
      }
      
      const { count: paymentsCount } = await paymentsQuery
        .select('*', { count: 'exact', head: true })
      deletionResults.payments = paymentsCount || 0
    } else {
      deletionResults.payments = 0
    }
    console.log(`   ✓ 결제: ${deletionResults.payments}개 삭제`)

    // 4-7. 매입 요청
    const { count: purchaseOrdersCount } = await supabaseAdmin
      .from('purchase_orders')
      .delete()
      .in('seller_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.purchase_orders = purchaseOrdersCount || 0
    console.log(`   ✓ 매입 요청: ${deletionResults.purchase_orders}개 삭제`)

    // 4-8. 구매 요청
    const { count: purchaseRequestsCount } = await supabaseAdmin
      .from('purchase_requests')
      .delete()
      .in('buyer_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.purchase_requests = purchaseRequestsCount || 0
    console.log(`   ✓ 구매 요청: ${deletionResults.purchase_requests}개 삭제`)

    // 4-9. 상품
    const { count: productsCount } = await supabaseAdmin
      .from('products')
      .delete()
      .in('seller_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.products = productsCount || 0
    console.log(`   ✓ 상품: ${deletionResults.products}개 삭제`)

    // 4-10. 판매 리스트
    const { count: salesListsCount } = await supabaseAdmin
      .from('sales_lists')
      .delete()
      .in('seller_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.sales_lists = salesListsCount || 0
    console.log(`   ✓ 판매 리스트: ${deletionResults.sales_lists}개 삭제`)

    // 4-11. 재고 분석
    const { count: analysesCount } = await supabaseAdmin
      .from('inventory_analyses')
      .delete()
      .in('user_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.inventory_analyses = analysesCount || 0
    console.log(`   ✓ 재고 분석: ${deletionResults.inventory_analyses}개 삭제`)

    // 4-12. 사용자 프로필
    const { count: profilesCount } = await supabaseAdmin
      .from('profiles')
      .delete()
      .neq('role', 'admin')
      .select('*', { count: 'exact', head: true })
    deletionResults.profiles = profilesCount || 0
    console.log(`   ✓ 사용자 프로필: ${deletionResults.profiles}개 삭제`)

    console.log()

    // 5. 결과 요약
    const totalDeleted = Object.values(deletionResults).reduce((sum, count) => sum + count, 0)

    console.log('✅ 초기화 완료!')
    console.log()
    console.log('📊 삭제 요약:')
    console.log(`   총 삭제 항목: ${totalDeleted}개`)
    console.log(`   삭제된 사용자: ${nonAdminIds.length}명`)
    console.log(`   보존된 관리자: ${adminIds.length}명`)
    console.log()
    console.log('📋 상세 내역:')
    Object.entries(deletionResults).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`   - ${table}: ${count}개`)
      }
    })
    console.log()
    console.log('⚠️  참고: Supabase Auth 사용자(auth.users)는 별도로 삭제해야 합니다.')
    console.log('   Supabase Dashboard → Authentication → Users에서 수동 삭제하세요.')

  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// 스크립트 실행
resetTestData()


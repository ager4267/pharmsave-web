/**
 * Supabase 데이터 직접 초기화 스크립트
 * Service Role Key를 사용하여 직접 데이터베이스에 접근
 */

const { createClient } = require('@supabase/supabase-js')
const readline = require('readline')

// 환경 변수 로드 시도
const fs = require('fs')
const path = require('path')

// .env.local 파일 직접 읽기
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim()
        process.env[key.trim()] = value
      }
    }
  })
}

// dotenv도 시도
try {
  require('dotenv').config({ path: '.env.local' })
} catch (e) {
  // dotenv가 없어도 계속 진행
}

async function main() {
  console.log('🔄 Supabase 데이터 직접 초기화\n')

  // 환경 변수 확인
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ 환경 변수가 설정되지 않았습니다.')
    console.error('필요한 환경 변수:')
    console.error('  - NEXT_PUBLIC_SUPABASE_URL')
    console.error('  - SUPABASE_SERVICE_ROLE_KEY')
    console.error('\n.env.local 파일을 확인하세요.')
    process.exit(1)
  }

  console.log('✅ 연결 정보 확인 완료')
  console.log(`   URL: ${supabaseUrl.substring(0, 40)}...`)
  console.log(`   Key: ${serviceRoleKey.substring(0, 20)}...\n`)

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  // 관리자 확인
  console.log('📋 관리자 계정 확인 중...')
  const { data: adminProfiles, error: adminError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, company_name')
    .eq('role', 'admin')

  if (adminError) {
    console.error('❌ 관리자 조회 실패:', adminError.message)
    rl.close()
    process.exit(1)
  }

  const adminIds = adminProfiles?.map(p => p.id) || []

  if (adminIds.length === 0) {
    console.error('❌ 관리자 계정을 찾을 수 없습니다.')
    rl.close()
    process.exit(1)
  }

  console.log(`✅ 관리자 ${adminIds.length}명 확인:`)
  adminProfiles?.forEach(admin => {
    console.log(`   - ${admin.email}`)
  })

  // 삭제 대상 확인
  const { data: nonAdminProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .neq('role', 'admin')

  const nonAdminIds = nonAdminProfiles?.map(p => p.id) || []

  if (nonAdminIds.length === 0) {
    console.log('\nℹ️  삭제할 데이터가 없습니다.')
    rl.close()
    return
  }

  console.log(`\n⚠️  삭제 대상: ${nonAdminIds.length}명의 사용자 및 관련 데이터`)

  // 확인 (자동 실행 모드)
  console.log('\n⚠️  초기화를 시작합니다...')
  console.log('   (자동 실행 모드 - 확인 없이 진행)\n')

  // 초기화 실행
  console.log('\n🗑️  데이터 삭제 중...\n')

  const deletionResults = {}

  try {
    // 포인트 충전 요청
    const { count: c1 } = await supabaseAdmin
      .from('point_charge_requests')
      .delete()
      .in('user_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.point_charge_requests = c1 || 0
    console.log(`   ✓ 포인트 충전 요청: ${c1 || 0}개`)

    // 포인트 거래 내역
    const { count: c2 } = await supabaseAdmin
      .from('point_transactions')
      .delete()
      .in('user_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.point_transactions = c2 || 0
    console.log(`   ✓ 포인트 거래 내역: ${c2 || 0}개`)

    // 포인트 잔액
    const { count: c3 } = await supabaseAdmin
      .from('points')
      .delete()
      .in('user_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.points = c3 || 0
    console.log(`   ✓ 포인트 잔액: ${c3 || 0}개`)

    // 판매 승인 보고서
    const { count: c4a } = await supabaseAdmin
      .from('sales_approval_reports')
      .delete()
      .in('seller_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    const { count: c4b } = await supabaseAdmin
      .from('sales_approval_reports')
      .delete()
      .in('buyer_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.sales_approval_reports = (c4a || 0) + (c4b || 0)
    console.log(`   ✓ 판매 승인 보고서: ${deletionResults.sales_approval_reports}개`)

    // 재판매
    const { count: c5 } = await supabaseAdmin
      .from('resales')
      .delete()
      .in('buyer_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.resales = c5 || 0
    console.log(`   ✓ 재판매: ${c5 || 0}개`)

    // 결제
    const { data: prs } = await supabaseAdmin
      .from('purchase_requests')
      .select('id')
      .in('buyer_id', nonAdminIds)
    const { data: pos } = await supabaseAdmin
      .from('purchase_orders')
      .select('id')
      .in('seller_id', nonAdminIds)
    const prIds = prs?.map(p => p.id) || []
    const poIds = pos?.map(p => p.id) || []

    if (prIds.length > 0 || poIds.length > 0) {
      let paymentsQuery = supabaseAdmin.from('payments').delete()
      if (prIds.length > 0 && poIds.length > 0) {
        paymentsQuery = paymentsQuery.or(`purchase_request_id.in.(${prIds.join(',')}),purchase_order_id.in.(${poIds.join(',')})`)
      } else if (prIds.length > 0) {
        paymentsQuery = paymentsQuery.in('purchase_request_id', prIds)
      } else {
        paymentsQuery = paymentsQuery.in('purchase_order_id', poIds)
      }
      const { count: c6 } = await paymentsQuery.select('*', { count: 'exact', head: true })
      deletionResults.payments = c6 || 0
    } else {
      deletionResults.payments = 0
    }
    console.log(`   ✓ 결제: ${deletionResults.payments}개`)

    // 매입 요청
    const { count: c7 } = await supabaseAdmin
      .from('purchase_orders')
      .delete()
      .in('seller_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.purchase_orders = c7 || 0
    console.log(`   ✓ 매입 요청: ${c7 || 0}개`)

    // 구매 요청
    const { count: c8 } = await supabaseAdmin
      .from('purchase_requests')
      .delete()
      .in('buyer_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.purchase_requests = c8 || 0
    console.log(`   ✓ 구매 요청: ${c8 || 0}개`)

    // 상품
    const { count: c9 } = await supabaseAdmin
      .from('products')
      .delete()
      .in('seller_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.products = c9 || 0
    console.log(`   ✓ 상품: ${c9 || 0}개`)

    // 판매 리스트
    const { count: c10 } = await supabaseAdmin
      .from('sales_lists')
      .delete()
      .in('seller_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.sales_lists = c10 || 0
    console.log(`   ✓ 판매 리스트: ${c10 || 0}개`)

    // 재고 분석
    const { count: c11 } = await supabaseAdmin
      .from('inventory_analyses')
      .delete()
      .in('user_id', nonAdminIds)
      .select('*', { count: 'exact', head: true })
    deletionResults.inventory_analyses = c11 || 0
    console.log(`   ✓ 재고 분석: ${c11 || 0}개`)

    // 사용자 프로필
    const { count: c12 } = await supabaseAdmin
      .from('profiles')
      .delete()
      .neq('role', 'admin')
      .select('*', { count: 'exact', head: true })
    deletionResults.profiles = c12 || 0
    console.log(`   ✓ 사용자 프로필: ${c12 || 0}개`)

    console.log()
    const total = Object.values(deletionResults).reduce((sum, count) => sum + count, 0)
    console.log('✅ 초기화 완료!')
    console.log(`   총 삭제 항목: ${total}개`)
    console.log(`   보존된 관리자: ${adminIds.length}명`)

  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    console.error(error)
    process.exit(1)
  }
}

main().catch(console.error)


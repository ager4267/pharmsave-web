/**
 * 데이터 상태 확인 스크립트
 */

const { createClient } = require('@supabase/supabase-js')
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

async function checkData() {
  console.log('📊 데이터 상태 확인\n')

  try {
    // 관리자 확인
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'admin')
    
    console.log(`관리자: ${admins?.length || 0}명`)
    admins?.forEach(admin => {
      console.log(`  - ${admin.email}`)
    })

    // 일반 사용자 확인
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .neq('role', 'admin')
    
    console.log(`\n일반 사용자: ${users?.length || 0}명`)
    if (users && users.length > 0) {
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.role})`)
      })
    }

    // 각 테이블 데이터 확인
    const tables = [
      'sales_lists',
      'products',
      'purchase_requests',
      'purchase_orders',
      'points',
      'point_transactions',
      'point_charge_requests',
      'sales_approval_reports',
      'inventory_analyses'
    ]

    console.log('\n📋 테이블별 데이터 수:')
    for (const table of tables) {
      const { count } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
      console.log(`  ${table}: ${count || 0}개`)
    }

  } catch (error) {
    console.error('❌ 오류:', error.message)
  }
}

checkData()




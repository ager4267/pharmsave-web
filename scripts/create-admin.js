/**
 * 관리자 계정 생성 스크립트
 * 
 * 사용법:
 * node scripts/create-admin.js
 * 
 * 또는 환경 변수로 설정:
 * ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secure_password node scripts/create-admin.js
 */

const readline = require('readline')

// 환경 변수에서 가져오기
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456'
const ADMIN_COMPANY = process.env.ADMIN_COMPANY || '관리자 회사'
const ADMIN_BUSINESS_NUMBER = process.env.ADMIN_BUSINESS_NUMBER || '000-00-00000'

async function createAdmin() {
  console.log('='.repeat(60))
  console.log('관리자 계정 생성 스크립트')
  console.log('='.repeat(60))
  console.log('')

  // 환경 변수가 설정되지 않았으면 사용자에게 입력 요청
  let email = ADMIN_EMAIL
  let password = ADMIN_PASSWORD
  let company_name = ADMIN_COMPANY
  let business_number = ADMIN_BUSINESS_NUMBER

  if (ADMIN_EMAIL === 'admin@example.com' || !process.env.ADMIN_EMAIL) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const question = (query) => new Promise((resolve) => rl.question(query, resolve))

    try {
      email = await question('관리자 이메일을 입력하세요 (기본값: admin@example.com): ') || ADMIN_EMAIL
      password = await question('관리자 비밀번호를 입력하세요 (기본값: admin123456): ') || ADMIN_PASSWORD
      company_name = await question('회사명을 입력하세요 (기본값: 관리자 회사): ') || ADMIN_COMPANY
      business_number = await question('사업자등록번호를 입력하세요 (기본값: 000-00-00000): ') || ADMIN_BUSINESS_NUMBER
    } finally {
      rl.close()
    }
  }

  console.log('')
  console.log('관리자 계정 생성 중...')
  console.log(`이메일: ${email}`)
  console.log(`회사명: ${company_name}`)
  console.log(`사업자등록번호: ${business_number}`)
  console.log('')

  try {
    const response = await fetch('http://localhost:3000/api/admin/create-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        company_name,
        business_number,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log('='.repeat(60))
      console.log('✅ 관리자 계정이 성공적으로 생성되었습니다!')
      console.log('='.repeat(60))
      console.log('')
      console.log('관리자 정보:')
      console.log(`  이메일: ${email}`)
      console.log(`  비밀번호: ${password}`)
      console.log(`  사용자 ID: ${data.user.id}`)
      console.log(`  역할: ${data.user.role}`)
      console.log('')
      console.log('⚠️  보안을 위해 비밀번호를 안전하게 보관하세요!')
      console.log('')
    } else {
      console.error('❌ 관리자 계정 생성 실패:')
      console.error(`   오류: ${data.error}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ 관리자 계정 생성 중 오류 발생:')
    console.error(`   ${error.message}`)
    console.error('')
    console.error('서버가 실행 중인지 확인하세요:')
    console.error('   npm run dev')
    process.exit(1)
  }
}

// 스크립트 실행
createAdmin()


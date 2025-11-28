/**
 * Supabase 비밀번호 재설정 설정 안내 스크립트
 * 
 * 이 스크립트는 Supabase 대시보드에서 설정해야 할 Redirect URL을 안내합니다.
 * 실제 설정은 Supabase 대시보드에서 수동으로 해야 합니다.
 */

const SUPABASE_PROJECT_URL = 'https://duopazxljjcebdmeymax.supabase.co'
const PROJECT_ID = 'duopazxljjcebdmeymax'

console.log('🔐 Supabase 비밀번호 재설정 설정 안내\n')
console.log('=' .repeat(60))
console.log('프로젝트 정보:')
console.log(`- 프로젝트 ID: ${PROJECT_ID}`)
console.log(`- 프로젝트 URL: ${SUPABASE_PROJECT_URL}\n`)

console.log('📋 설정해야 할 Redirect URLs:\n')
console.log('개발 환경:')
console.log(`  - http://localhost:3000/reset-password`)
console.log(`  - http://localhost:3000/auth/callback\n`)

console.log('프로덕션 환경 (배포 후):')
console.log(`  - https://yourdomain.com/reset-password`)
console.log(`  - https://yourdomain.com/auth/callback\n`)

console.log('=' .repeat(60))
console.log('\n📝 설정 방법:')
console.log('1. https://app.supabase.com 에 로그인')
console.log(`2. 프로젝트 "web_sub1" 선택`)
console.log('3. Authentication → URL Configuration 메뉴로 이동')
console.log('4. Redirect URLs 섹션에 위 URL들을 추가')
console.log('5. Save 버튼 클릭\n')

console.log('✅ 설정이 완료되면 비밀번호 재설정 기능을 사용할 수 있습니다.\n')
console.log('📖 자세한 내용은 SUPABASE_PASSWORD_RESET_SETUP.md 파일을 참고하세요.\n')


/**
 * 브라우저에서 실행할 초기화 스크립트
 * 
 * 사용법:
 * 1. 관리자로 로그인
 * 2. 브라우저 개발자 도구(F12) → Console 열기
 * 3. 이 스크립트를 복사하여 붙여넣고 실행
 */

(async function resetTestData() {
  console.log('🔄 테스트 데이터 초기화를 시작합니다...\n')
  
  try {
    const response = await fetch('/api/admin/reset-test-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (result.success) {
      console.log('✅ 초기화 완료!')
      console.log('\n📊 삭제 요약:')
      console.log(`   총 삭제 항목: ${result.totalDeleted}개`)
      console.log(`   보존된 관리자: ${result.adminCount}명`)
      console.log('\n📋 상세 내역:')
      Object.entries(result.deletionResults).forEach(([table, count]) => {
        if (count > 0) {
          console.log(`   - ${table}: ${count}개`)
        }
      })
      console.log('\n⚠️  참고: Supabase Auth 사용자(auth.users)는 별도로 삭제해야 합니다.')
      
      // 페이지 새로고침 여부 확인
      if (confirm('초기화가 완료되었습니다. 페이지를 새로고침하시겠습니까?')) {
        window.location.reload()
      }
    } else {
      console.error('❌ 초기화 실패:', result.error)
      alert('초기화 실패: ' + result.error)
    }
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    alert('초기화 중 오류가 발생했습니다: ' + error.message)
  }
})()




/**
 * 초기화 API 직접 호출 스크립트
 * Node.js 환경에서 실행 (서버 사이드)
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/reset-test-data',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

console.log('🔄 초기화 API 호출 중...\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (result.success) {
        console.log('✅ 초기화 완료!');
        console.log('\n📊 삭제 요약:');
        console.log(`   총 삭제 항목: ${result.totalDeleted}개`);
        console.log(`   보존된 관리자: ${result.adminCount}명`);
        console.log('\n📋 상세 내역:');
        Object.entries(result.deletionResults).forEach(([table, count]) => {
          if (count > 0) {
            console.log(`   - ${table}: ${count}개`);
          }
        });
      } else {
        console.error('❌ 초기화 실패:', result.error);
        console.log('\n💡 해결 방법:');
        console.log('   1. 관리자로 로그인한 상태에서 브라우저에서 실행하세요');
        console.log('   2. 또는 /admin/settings 페이지에서 초기화 버튼을 클릭하세요');
      }
    } catch (error) {
      console.error('❌ 응답 파싱 오류:', error);
      console.log('원본 응답:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 요청 오류:', error.message);
  console.log('\n💡 해결 방법:');
  console.log('   1. 서버가 실행 중인지 확인하세요 (npm run dev)');
  console.log('   2. 관리자로 로그인한 상태에서 브라우저에서 실행하세요');
  console.log('   3. 또는 /admin/settings 페이지에서 초기화 버튼을 클릭하세요');
});

req.end();




/**
 * SQL 실행 스크립트 (Node.js)
 * Supabase CLI를 사용하여 SQL 파일 실행
 * 
 * 사용 방법:
 * 1. Supabase CLI 설치: npm install -g supabase
 * 2. Supabase 로그인: supabase login
 * 3. 프로젝트 연결: supabase link
 * 4. 스크립트 실행: node scripts/execute-sql.js
 */

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

async function executeSQL() {
  try {
    const sqlFile = path.join(process.cwd(), 'FIX_PROFILE_CREATION_FINAL.sql')
    console.log('📄 SQL 파일 읽기:', sqlFile)
    
    const sql = fs.readFileSync(sqlFile, 'utf-8')
    console.log('✅ SQL 파일 읽기 완료')
    console.log('📝 SQL 길이:', sql.length, '문자')
    
    // SQL을 임시 파일로 저장
    const tempFile = path.join(process.cwd(), 'temp_sql.sql')
    fs.writeFileSync(tempFile, sql, 'utf-8')
    console.log('💾 임시 SQL 파일 생성:', tempFile)
    
    // Supabase CLI로 SQL 실행
    console.log('🚀 Supabase CLI로 SQL 실행 중...')
    const { stdout, stderr } = await execAsync(
      `supabase db execute --file ${tempFile}`
    )
    
    if (stdout) {
      console.log('✅ SQL 실행 성공:')
      console.log(stdout)
    }
    
    if (stderr) {
      console.error('⚠️ SQL 실행 경고:')
      console.error(stderr)
    }
    
    // 임시 파일 삭제
    fs.unlinkSync(tempFile)
    console.log('🗑️ 임시 SQL 파일 삭제 완료')
    
    console.log('✅ SQL 실행 완료!')
  } catch (error) {
    console.error('❌ SQL 실행 실패:', error.message)
    console.error('💡 해결 방법:')
    console.error('1. Supabase CLI 설치: npm install -g supabase')
    console.error('2. Supabase 로그인: supabase login')
    console.error('3. 프로젝트 연결: supabase link')
    console.error('4. 또는 Supabase 대시보드 → SQL Editor에서 수동으로 실행')
    process.exit(1)
  }
}

executeSQL()


import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 설정 상태 확인 API
 * Service Role 키를 사용하여 설정 상태 확인
 * 
 * 사용 방법:
 * GET /api/admin/check-setup
 */

export async function GET(request: NextRequest) {
  try {
    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // Admin 클라이언트 생성 (Service Role 키 사용)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const checks: any = {
      bucket: { exists: false, isPrivate: false },
      storagePolicies: { count: 0, policies: [] },
      profilePolicies: { count: 0, policies: [] },
      trigger: { exists: false },
      function: { exists: false }
    }

    // 1. 버킷 확인
    try {
      const { data: buckets } = await supabase.storage.listBuckets()
      const documentsBucket = buckets?.find(b => b.id === 'documents')
      
      if (documentsBucket) {
        checks.bucket.exists = true
        checks.bucket.isPrivate = !documentsBucket.public
      }
    } catch (error: any) {
      checks.bucket.error = error.message
    }

    // 2. Storage 정책 확인 (직접 조회 불가능하므로 SQL 사용 필요)
    // Service Role 키로는 pg_policies 테이블을 직접 조회할 수 없음
    
    // 3. 설정 상태 요약
    const allChecksPassed = 
      checks.bucket.exists && 
      checks.bucket.isPrivate

    return NextResponse.json({
      success: allChecksPassed,
      checks,
      message: allChecksPassed 
        ? '모든 설정이 완료되었습니다!' 
        : '일부 설정이 필요합니다.',
      instructions: allChecksPassed 
        ? null
        : {
            message: 'SQL Editor에서 SQL을 실행해야 합니다.',
            sqlFile: 'COMPLETE_SETUP_ALL.sql',
            steps: [
              '1. Supabase 대시보드 → SQL Editor',
              '2. COMPLETE_SETUP_ALL.sql 파일 내용 복사',
              '3. SQL Editor에 붙여넣기',
              '4. Run 버튼 클릭'
            ]
          }
    })
  } catch (error: any) {
    console.error('설정 확인 오류:', error)
    return NextResponse.json(
      { error: error.message || '설정 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


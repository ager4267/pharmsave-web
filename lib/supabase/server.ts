import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Server Component용 클라이언트
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '설정됨' : '없음')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '설정됨' : '없음')
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.')
  }

  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    } as any
  )
}

// Route Handler용 클라이언트 (NextRequest/NextResponse 사용)
// Supabase SSR 공식 예제 기반
// 참고: https://supabase.com/docs/guides/auth/server-side/creating-a-client
export function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  }

  // createServerClient 생성 - Supabase SSR 공식 예제 방식
  // 중요: getAll은 Supabase SSR이 내부적으로 호출하므로, 항상 최신 쿠키를 반환해야 함
  // 빌드 타임 평가 방지: request와 response를 클로저로 캡처하여 런타임에만 접근
  const requestRef = request
  const responseRef = response
  
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // NextRequest.cookies에서 직접 가져오기 (매번 최신 상태)
        // 빌드 타임 평가 방지: requestRef는 런타임에만 접근 가능
        const cookies: Array<{ name: string; value: string }> = []
        try {
          if (requestRef && requestRef.cookies) {
            const allCookies = requestRef.cookies.getAll()
            console.log('🔍 [createRouteHandlerClient] getAll 호출됨! 원본 쿠키:', allCookies.length, '개')
            
            allCookies.forEach(cookie => {
              cookies.push({ name: cookie.name, value: cookie.value })
            })
            
            // 디버깅: Supabase 관련 쿠키 확인
            const supabaseCookies = cookies.filter(c => 
              c.name.includes('sb-') || c.name.includes('supabase')
            )
            if (supabaseCookies.length > 0) {
              console.log('🍪 [createRouteHandlerClient] getAll - Supabase 쿠키:', supabaseCookies.length, '개')
            } else {
              console.warn('⚠️ [createRouteHandlerClient] getAll - Supabase 쿠키 없음. 전체:', cookies.length, '개')
            }
          }
        } catch (error: any) {
          // 빌드 타임 오류는 무시 (런타임에만 실행되어야 함)
          if (error?.digest === 'DYNAMIC_SERVER_USAGE' || 
              error?.description?.includes('rendered statically') ||
              error?.message?.includes('rendered statically')) {
            // 빌드 타임 평가 오류는 무시 (정상적인 동작)
            // 빌드 타임에는 빈 배열 반환, 런타임에는 정상 작동
            return []
          } else {
            console.error('❌ [createRouteHandlerClient] getAll 오류:', error)
          }
        }
        return cookies
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        try {
          if (responseRef && responseRef.cookies) {
            console.log('🍪 [createRouteHandlerClient] setAll 호출:', cookiesToSet.length, '개 쿠키 설정')
            cookiesToSet.forEach(({ name, value, options }) => {
              // NextResponse.cookies.set은 options를 직접 받을 수 있습니다
              try {
                if (options) {
                  responseRef.cookies.set(name, value, options)
                } else {
                  responseRef.cookies.set(name, value)
                }
              } catch (error) {
                console.error(`❌ [createRouteHandlerClient] 쿠키 설정 오류 (${name}):`, error)
              }
            })
          }
        } catch (error: any) {
          // 빌드 타임 오류는 무시
          if (error?.digest === 'DYNAMIC_SERVER_USAGE' || 
              error?.description?.includes('rendered statically') ||
              error?.message?.includes('rendered statically')) {
            // 빌드 타임 평가 오류는 무시 (정상적인 동작)
            return
          } else {
            console.error('❌ [createRouteHandlerClient] setAll 오류:', error)
          }
        }
      },
    },
  } as any)
  
  return client
}


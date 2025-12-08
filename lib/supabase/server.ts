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
export function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  }

  // createServerClient 생성 - Supabase SSR 공식 예제 방식
  // 참고: https://supabase.com/docs/guides/auth/server-side/creating-a-client
  // 중요: getAll은 Supabase SSR이 내부적으로 호출하므로, 항상 최신 쿠키를 반환해야 함
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // NextRequest.cookies에서 직접 가져오기 (매번 최신 상태)
        const cookies: Array<{ name: string; value: string }> = []
        try {
          const allCookies = request.cookies.getAll()
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
            supabaseCookies.forEach(c => {
              console.log(`🍪 [createRouteHandlerClient] 쿠키 ${c.name}: 길이=${c.value.length}, 시작=${c.value.substring(0, 50)}...`)
            })
          } else {
            console.warn('⚠️ [createRouteHandlerClient] getAll - Supabase 쿠키 없음. 전체:', cookies.length, '개')
            console.warn('⚠️ [createRouteHandlerClient] 전체 쿠키 이름:', cookies.map(c => c.name).join(', '))
          }
        } catch (error) {
          console.error('❌ [createRouteHandlerClient] getAll 오류:', error)
        }
        console.log('🔍 [createRouteHandlerClient] getAll 반환:', cookies.length, '개 쿠키')
        return cookies
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        console.log('🍪 [createRouteHandlerClient] setAll 호출:', cookiesToSet.length, '개 쿠키 설정')
        cookiesToSet.forEach(({ name, value, options }) => {
          // NextResponse.cookies.set은 options를 직접 받을 수 있습니다
          try {
            if (options) {
              response.cookies.set(name, value, options)
            } else {
              response.cookies.set(name, value)
            }
          } catch (error) {
            console.error(`❌ [createRouteHandlerClient] 쿠키 설정 오류 (${name}):`, error)
          }
        })
      },
    },
  } as any)
  
  console.log('✅ [createRouteHandlerClient] 클라이언트 생성 완료')
  return client
}


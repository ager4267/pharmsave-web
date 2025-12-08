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
export function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  }

  // 쿠키를 캐시하여 매번 파싱하지 않도록
  let cachedCookies: Array<{ name: string; value: string }> | null = null
  
  const getAllCookies = (): Array<{ name: string; value: string }> => {
    if (cachedCookies) {
      return cachedCookies
    }
    
    const cookies: Array<{ name: string; value: string }> = []
    
    // NextRequest.cookies에서 가져오기
    try {
      const allCookies = request.cookies.getAll()
      allCookies.forEach(cookie => {
        cookies.push({ name: cookie.name, value: cookie.value })
      })
      
      // 디버깅: Supabase 관련 쿠키 확인
      const supabaseCookies = cookies.filter(c => 
        c.name.includes('sb-') || c.name.includes('supabase')
      )
      if (supabaseCookies.length > 0) {
        console.log('🍪 [createRouteHandlerClient] Supabase 쿠키 발견:', supabaseCookies.map(c => c.name).join(', '))
        console.log('🍪 [createRouteHandlerClient] 전체 쿠키 개수:', cookies.length)
        // 쿠키 값의 일부만 로그 (보안)
        supabaseCookies.forEach(c => {
          console.log(`🍪 [createRouteHandlerClient] 쿠키 ${c.name}: ${c.value.substring(0, 50)}...`)
        })
      } else {
        console.warn('⚠️ [createRouteHandlerClient] Supabase 쿠키가 없습니다. 전체 쿠키:', cookies.map(c => c.name).join(', '))
      }
    } catch (error) {
      console.error('❌ [createRouteHandlerClient] 쿠키 읽기 오류:', error)
    }
    
    cachedCookies = cookies
    return cookies
  }

  // createServerClient 생성
  // Supabase SSR은 쿠키를 자동으로 파싱하므로, 우리는 단순히 전달만 하면 됩니다
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = getAllCookies()
        // 디버깅: getAll이 반환하는 쿠키 확인
        if (cookies.length > 0) {
          const supabaseCookies = cookies.filter(c => c.name.includes('sb-'))
          if (supabaseCookies.length > 0) {
            console.log('🍪 [createRouteHandlerClient] getAll 반환:', supabaseCookies.length, '개 Supabase 쿠키')
            // 쿠키 값의 일부만 로그 (보안)
            supabaseCookies.forEach(c => {
              console.log(`🍪 [createRouteHandlerClient] 쿠키 ${c.name}: 길이=${c.value.length}, 시작=${c.value.substring(0, 20)}...`)
            })
          }
        }
        return cookies
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        console.log('🍪 [createRouteHandlerClient] setAll 호출:', cookiesToSet.length, '개 쿠키 설정')
        cookiesToSet.forEach(({ name, value, options }) => {
          // NextResponse.cookies.set은 options를 직접 받을 수 있습니다
          if (options) {
            response.cookies.set(name, value, options)
          } else {
            response.cookies.set(name, value)
          }
        })
        // 쿠키가 설정되면 캐시 무효화
        cachedCookies = null
      },
    },
  } as any)
  
  return client
}


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
    const allCookies = request.cookies.getAll()
    allCookies.forEach(cookie => {
      cookies.push({ name: cookie.name, value: cookie.value })
    })
    
    // 디버깅: Supabase 관련 쿠키 확인
    const supabaseCookies = cookies.filter(c => 
      c.name.includes('sb-') || c.name.includes('supabase')
    )
    if (supabaseCookies.length > 0) {
      console.log('🍪 Supabase 쿠키 발견:', supabaseCookies.map(c => c.name).join(', '))
      console.log('🍪 전체 쿠키 개수:', cookies.length)
    }
    
    cachedCookies = cookies
    return cookies
  }

  // createServerClient 생성
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return getAllCookies()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
        // 쿠키가 설정되면 캐시 무효화
        cachedCookies = null
      },
    },
  } as any)
  
  return client
}


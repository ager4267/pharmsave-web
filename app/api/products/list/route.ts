import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * 승인된 상품 목록 조회 API
 * GET /api/products/list
 * 
 * 캐시 방지: 항상 최신 데이터를 반환합니다.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // Service Role 클라이언트 생성 (RLS 정책 우회)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 먼저 전체 상품 수 확인 (디버깅용)
    console.log('🔍 상품 통계 조회 시작...')
    const { count: totalCount, error: totalCountError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
    
    if (totalCountError) {
      console.error('❌ 전체 상품 수 조회 오류:', totalCountError)
    }
    
    const { count: activeCount, error: activeCountError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    if (activeCountError) {
      console.error('❌ active 상품 수 조회 오류:', activeCountError)
    }

    console.log('📊 상품 통계:', {
      total: totalCount || 0,
      active: activeCount || 0,
      totalError: totalCountError?.message,
      activeError: activeCountError?.message,
    })

    // 승인된 상품 목록 조회 (status='active'인 상품들)
    // 안정성을 위해 상품을 먼저 조회하고 profiles를 별도로 조회하여 병합
    let productsData: any[] = []
    let productsError: any = null

    try {
      // 1. 상품 목록 조회 (status='active'이고 quantity > 0인 상품만)
      console.log('🔍 상품 목록 조회 시작...')
      const { data: productsOnly, error: productsOnlyError } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .gt('quantity', 0)
        .order('created_at', { ascending: false })

      if (productsOnlyError) {
        console.error('❌ 상품 조회 실패:', productsOnlyError)
        productsError = productsOnlyError
      } else {
        console.log('✅ 상품 조회 성공:', productsOnly?.length || 0, '개')
        productsData = productsOnly || []
        
        // 2. profiles 정보를 별도로 조회하여 병합
        if (productsData.length > 0) {
          const sellerIds = [...new Set(productsData.map(p => p.seller_id).filter(Boolean))]
          console.log('🔍 profiles 별도 조회 시도, sellerIds:', sellerIds.length, '개')
          
          if (sellerIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('id, company_name, email')
              .in('id', sellerIds)
            
            if (profilesError) {
              console.warn('⚠️ profiles 별도 조회 실패:', profilesError.message)
              // profiles 조회 실패해도 상품은 반환
            } else {
              console.log('✅ profiles 별도 조회 성공:', profilesData?.length || 0, '개')
              if (profilesData && profilesData.length > 0) {
                const profilesMap = new Map(profilesData.map(p => [p.id, p]))
                productsData = productsData.map(product => ({
                  ...product,
                  profiles: profilesMap.get(product.seller_id) || null
                }))
                console.log('✅ profiles 병합 완료')
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('상품 조회 예외:', err)
      productsError = err
    }

    if (productsError) {
      console.error('상품 조회 오류:', productsError)
      console.error('오류 상세:', {
        message: productsError.message,
        details: productsError.details,
        hint: productsError.hint,
        code: productsError.code,
      })
      return NextResponse.json(
        { success: false, error: `상품 조회 실패: ${productsError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 상품 조회 성공:', {
      count: productsData?.length || 0,
      isArray: Array.isArray(productsData),
      sample: productsData?.[0] ? {
        id: productsData[0].id,
        name: productsData[0].product_name,
        status: productsData[0].status,
        seller: productsData[0].profiles?.company_name,
        profilesType: typeof productsData[0].profiles,
      } : null,
    })

    // 상품이 없는 경우 경고 로그
    if (!productsData || productsData.length === 0) {
      console.warn('⚠️ 조회된 상품이 없습니다. 다음을 확인하세요:')
      console.warn('  1. 판매 리스트가 승인되었는지 확인')
      console.warn('  2. 승인된 판매 리스트의 상품이 products 테이블에 생성되었는지 확인')
      console.warn('  3. 상품의 status가 "active"인지 확인')
    }

    // 응답 데이터 검증
    const responseData = {
      success: true,
      products: Array.isArray(productsData) ? productsData : [],
      count: Array.isArray(productsData) ? productsData.length : 0,
      stats: {
        total: totalCount || 0,
        active: activeCount || 0,
      },
    }

    console.log('📤 응답 데이터:', {
      success: responseData.success,
      productsCount: responseData.products.length,
      count: responseData.count,
      stats: responseData.stats,
    })

    // 캐시 방지 헤더 추가
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}


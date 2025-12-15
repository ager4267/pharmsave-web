import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 동적 렌더링 강제
export const dynamic = 'force-dynamic'

/**
 * 판매승인보고서 전달 문제 진단 API
 * MCP 서버를 통한 심층 분석
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('seller_id')
    const purchaseRequestId = searchParams.get('purchase_request_id')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const diagnosis: any = {
      timestamp: new Date().toISOString(),
      sellerId: sellerId || null,
      purchaseRequestId: purchaseRequestId || null,
      checks: [],
      issues: [],
      recommendations: [],
    }

    // 1. 판매자 프로필 확인
    if (sellerId) {
      const { data: sellerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, company_name, role, license_verification_status')
        .eq('id', sellerId)
        .maybeSingle()

      diagnosis.checks.push({
        name: '판매자 프로필 확인',
        passed: !profileError && !!sellerProfile,
        details: {
          profile: sellerProfile,
          error: profileError,
        },
      })

      if (profileError || !sellerProfile) {
        diagnosis.issues.push({
          severity: 'critical',
          message: '판매자 프로필이 존재하지 않습니다.',
          sellerId: sellerId,
          error: profileError,
        })
      } else if (sellerProfile.role === 'admin') {
        diagnosis.issues.push({
          severity: 'warning',
          message: '판매자가 관리자 계정입니다. 일반 판매자 계정인지 확인하세요.',
        })
      }
    }

    // 2. 구매 요청 확인
    if (purchaseRequestId) {
      const { data: purchaseRequest, error: prError } = await supabase
        .from('purchase_requests')
        .select('*, product:products!purchase_requests_product_id_fkey(id, product_name, seller_id)')
        .eq('id', purchaseRequestId)
        .maybeSingle()

      diagnosis.checks.push({
        name: '구매 요청 확인',
        passed: !prError && !!purchaseRequest,
        details: {
          purchaseRequest: purchaseRequest ? {
            id: purchaseRequest.id,
            buyer_id: purchaseRequest.buyer_id,
            product_id: purchaseRequest.product_id,
            status: purchaseRequest.status,
            product: purchaseRequest.product,
          } : null,
          error: prError,
        },
      })

      if (purchaseRequest) {
        const product = Array.isArray(purchaseRequest.product) 
          ? purchaseRequest.product[0] 
          : purchaseRequest.product

        if (product && product.seller_id) {
          diagnosis.checks.push({
            name: '상품 seller_id 확인',
            passed: true,
            details: {
              productId: product.id,
              productName: product.product_name,
              sellerId: product.seller_id,
            },
          })

          // seller_id와 요청한 seller_id가 일치하는지 확인
          if (sellerId && product.seller_id !== sellerId) {
            diagnosis.issues.push({
              severity: 'critical',
              message: '구매 요청의 상품 seller_id와 요청한 seller_id가 일치하지 않습니다.',
              expected: sellerId,
              actual: product.seller_id,
            })
          }
        } else {
          diagnosis.issues.push({
            severity: 'critical',
            message: '구매 요청의 상품에 seller_id가 없습니다.',
            purchaseRequestId: purchaseRequestId,
          })
        }
      }
    }

    // 3. 판매승인보고서 조회 (seller_id로)
    if (sellerId) {
      const { data: reports, error: reportsError } = await supabase
        .from('sales_approval_reports')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })

      diagnosis.checks.push({
        name: '판매승인보고서 조회 (seller_id)',
        passed: !reportsError,
        details: {
          count: reports?.length || 0,
          reports: reports?.map((r: any) => ({
            id: r.id,
            report_number: r.report_number,
            seller_id: r.seller_id,
            buyer_id: r.buyer_id,
            status: r.status,
            created_at: r.created_at,
            sent_at: r.sent_at,
            purchase_request_id: r.purchase_request_id,
          })) || [],
          error: reportsError,
        },
      })

      if (reports && reports.length > 0) {
        // status별 통계
        const statusCounts = reports.reduce((acc: any, r: any) => {
          acc[r.status] = (acc[r.status] || 0) + 1
          return acc
        }, {})

        diagnosis.checks.push({
          name: '판매승인보고서 상태 통계',
          passed: true,
          details: {
            statusCounts,
            total: reports.length,
          },
        })

        // 'sent' 상태인 보고서 확인
        const sentReports = reports.filter((r: any) => r.status === 'sent')
        if (sentReports.length === 0) {
          diagnosis.issues.push({
            severity: 'warning',
            message: 'seller_id로 조회된 보고서 중 "sent" 상태인 보고서가 없습니다.',
            totalReports: reports.length,
            statuses: Object.keys(statusCounts),
          })
        }
      } else {
        diagnosis.issues.push({
          severity: 'critical',
          message: 'seller_id로 조회된 판매승인보고서가 없습니다.',
          sellerId: sellerId,
        })
      }
    }

    // 4. 구매 요청별 판매승인보고서 확인
    if (purchaseRequestId) {
      const { data: reports, error: reportsError } = await supabase
        .from('sales_approval_reports')
        .select('*')
        .eq('purchase_request_id', purchaseRequestId)
        .order('created_at', { ascending: false })

      diagnosis.checks.push({
        name: '구매 요청별 판매승인보고서 확인',
        passed: !reportsError,
        details: {
          count: reports?.length || 0,
          reports: reports?.map((r: any) => ({
            id: r.id,
            report_number: r.report_number,
            seller_id: r.seller_id,
            status: r.status,
            created_at: r.created_at,
            sent_at: r.sent_at,
          })) || [],
          error: reportsError,
        },
      })

      if (!reports || reports.length === 0) {
        diagnosis.issues.push({
          severity: 'critical',
          message: '구매 요청에 대한 판매승인보고서가 생성되지 않았습니다.',
          purchaseRequestId: purchaseRequestId,
        })
        diagnosis.recommendations.push({
          action: '구매 요청 승인 API를 다시 실행하여 판매승인보고서를 생성하세요.',
          endpoint: '/api/admin/approve-purchase-request',
        })
      } else {
        // 가장 최근 보고서 확인
        const latestReport = reports[0]
        if (latestReport.status !== 'sent') {
          diagnosis.issues.push({
            severity: 'warning',
            message: '가장 최근 판매승인보고서의 상태가 "sent"가 아닙니다.',
            reportId: latestReport.id,
            currentStatus: latestReport.status,
            expectedStatus: 'sent',
          })
        }
        if (!latestReport.sent_at) {
          diagnosis.issues.push({
            severity: 'warning',
            message: '가장 최근 판매승인보고서에 sent_at이 설정되지 않았습니다.',
            reportId: latestReport.id,
          })
        }
      }
    }

    // 5. RLS 정책 확인 (간접적으로)
    if (sellerId) {
      // Service Role로는 RLS를 우회하므로, 실제 판매자가 조회할 수 있는지 확인하려면
      // 판매자 프로필이 존재하고 seller_id가 일치하는지만 확인
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', sellerId)
        .maybeSingle()

      if (sellerProfile) {
        diagnosis.checks.push({
          name: 'RLS 정책 준수 가능성 확인',
          passed: true,
          details: {
            message: '판매자 프로필이 존재하므로 RLS 정책상 조회 가능해야 합니다.',
            sellerId: sellerId,
          },
        })
      }
    }

    // 6. 최근 생성된 판매승인보고서 확인 (전체)
    const { data: recentReports, error: recentError } = await supabase
      .from('sales_approval_reports')
      .select('id, report_number, seller_id, buyer_id, status, created_at, sent_at, purchase_request_id')
      .order('created_at', { ascending: false })
      .limit(10)

    diagnosis.checks.push({
      name: '최근 판매승인보고서 확인 (전체)',
      passed: !recentError,
      details: {
        count: recentReports?.length || 0,
        recentReports: recentReports?.map((r: any) => ({
          id: r.id,
          report_number: r.report_number,
          seller_id: r.seller_id,
          status: r.status,
          created_at: r.created_at,
          sent_at: r.sent_at,
        })) || [],
        error: recentError,
      },
    })

    // 종합 진단
    const criticalIssues = diagnosis.issues.filter((i: any) => i.severity === 'critical')
    const warnings = diagnosis.issues.filter((i: any) => i.severity === 'warning')

    diagnosis.summary = {
      totalChecks: diagnosis.checks.length,
      passedChecks: diagnosis.checks.filter((c: any) => c.passed).length,
      failedChecks: diagnosis.checks.filter((c: any) => c.passed === false).length,
      criticalIssues: criticalIssues.length,
      warnings: warnings.length,
      status: criticalIssues.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'ok',
    }

    return NextResponse.json({
      success: true,
      diagnosis,
    })
  } catch (error: any) {
    console.error('진단 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '진단 중 오류가 발생했습니다.',
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}


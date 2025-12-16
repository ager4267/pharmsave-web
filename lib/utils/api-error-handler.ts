import { NextResponse } from 'next/server'

/**
 * API 에러 응답 타입
 */
export interface ApiError {
  success: false
  error: string
  code?: string
  details?: unknown
}

/**
 * API 성공 응답 타입
 */
export interface ApiSuccess<T = unknown> {
  success: true
  data?: T
  message?: string
}

/**
 * 통합 API 응답 타입
 */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

/**
 * 에러 응답 생성 헬퍼
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  code?: string,
  details?: unknown
): NextResponse<ApiError> {
  const response: ApiError = {
    success: false,
    error,
    ...(code && { code }),
    ...(details && { details }),
  }

  return NextResponse.json(response, { status })
}

/**
 * 성공 응답 생성 헬퍼
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): NextResponse<ApiSuccess<T>> {
  const response: ApiSuccess<T> = {
    success: true,
    ...(data && { data }),
    ...(message && { message }),
  }

  return NextResponse.json(response)
}

/**
 * 에러를 안전하게 처리하는 래퍼
 */
export async function handleApiError(
  error: unknown,
  defaultMessage: string = '서버 오류가 발생했습니다.'
): Promise<NextResponse<ApiError>> {
  console.error('API 오류:', error)

  if (error instanceof Error) {
    // 알려진 에러 타입
    if (error.message.includes('환경 변수')) {
      return createErrorResponse('환경 변수가 설정되지 않았습니다.', 500, 'ENV_MISSING')
    }

    if (error.message.includes('인증') || error.message.includes('auth')) {
      return createErrorResponse('인증 오류가 발생했습니다.', 401, 'AUTH_ERROR')
    }

    return createErrorResponse(error.message || defaultMessage, 500, 'UNKNOWN_ERROR')
  }

  // 알 수 없는 에러 타입
  return createErrorResponse(defaultMessage, 500, 'UNKNOWN_ERROR')
}

/**
 * 요청 본문 검증 헬퍼
 */
export function validateRequestBody<T extends Record<string, unknown>>(
  body: unknown,
  requiredFields: (keyof T)[]
): { isValid: true; data: T } | { isValid: false; error: NextResponse<ApiError> } {
  if (!body || typeof body !== 'object') {
    return {
      isValid: false,
      error: createErrorResponse('요청 본문이 올바르지 않습니다.', 400, 'INVALID_BODY'),
    }
  }

  const missingFields = requiredFields.filter((field) => !(field in body))

  if (missingFields.length > 0) {
    return {
      isValid: false,
      error: createErrorResponse(
        `필수 필드가 누락되었습니다: ${missingFields.join(', ')}`,
        400,
        'MISSING_FIELDS',
        { missingFields }
      ),
    }
  }

  return {
    isValid: true,
    data: body as T,
  }
}


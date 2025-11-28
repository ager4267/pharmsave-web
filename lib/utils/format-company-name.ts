/**
 * 회사명 포맷팅 유틸리티
 * "임시회사명"을 필터링하고 실제 회사명 또는 대체값 반환
 * 괄호 안의 텍스트(예: (buyer), (seller) 등) 제거
 */
export function formatCompanyName(
  companyName: string | null | undefined,
  fallback: string = '-'
): string {
  if (!companyName || companyName === '임시회사명') {
    return fallback
  }
  // 괄호와 그 안의 내용 제거 (예: "조형익팜(buyer)" -> "조형익팜")
  return companyName.replace(/\s*\([^)]*\)\s*/g, '').trim()
}

/**
 * 회사명 표시 함수 (이메일 대신 회사명만 표시)
 * 회원가입 시 입력한 회사명만 표시
 */
export function formatCompanyNameWithEmail(
  companyName: string | null | undefined,
  email: string | null | undefined,
  fallback: string = '-'
): string {
  // 회사명이 있고 "임시회사명"이 아니면 회사명 반환
  if (companyName && companyName !== '임시회사명') {
    return companyName
  }
  // 그렇지 않으면 fallback 반환 (이메일 사용 안 함)
  return fallback
}


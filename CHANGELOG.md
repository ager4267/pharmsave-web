# 변경 이력 (CHANGELOG)

이 파일은 프로젝트의 주요 변경사항을 기록합니다.

## 형식
- 날짜: YYYY-MM-DD
- 변경 유형: [추가], [수정], [삭제], [버그수정]
- 파일 경로: 변경된 파일
- 설명: 변경 내용

---

## 2025-01-27

### [추가] 원장 조회 기능
- **파일**: 
  - `app/api/admin/ledger/route.ts`
  - `app/api/user/ledger/route.ts`
  - `app/(dashboard)/admin/ledger/page.tsx`
  - `app/(dashboard)/seller/points/ledger/page.tsx`
- **설명**: 관리자 및 사용자용 원장 조회 기능 추가. 입금 내역과 포인트 충전/사용 내역을 확인할 수 있음.

### [수정] 원장 조회 - 포인트 사용 내역으로 변경
- **파일**: 
  - `app/api/admin/ledger/route.ts`
  - `app/api/user/ledger/route.ts`
  - `app/(dashboard)/admin/ledger/page.tsx`
  - `app/(dashboard)/seller/points/ledger/page.tsx`
- **설명**: "포인트 충전 내역"을 "포인트 사용 내역"으로 변경하고, 충전/사용/환불을 모두 표시하도록 수정.

### [수정] 재고분석 - 분석기간 부가 설명 추가
- **파일**: `app/(dashboard)/seller/inventory-analysis/page.tsx`
- **설명**: 분석 기간 선택 시 각 기간에 대한 설명 추가 (3개월/6개월별 분석 기준 설명)

---

## 변경사항 기록 가이드

### 변경사항을 기록할 때:
1. **날짜**를 정확히 기록
2. **변경 유형**을 명확히 표시
3. **파일 경로**를 구체적으로 기록
4. **변경 내용**을 상세히 설명
5. **관련 이슈나 요구사항**이 있으면 함께 기록

### 변경 유형:
- `[추가]`: 새로운 기능 추가
- `[수정]`: 기존 기능 수정
- `[삭제]`: 기능 삭제
- `[버그수정]`: 버그 수정
- `[개선]`: 성능 개선 또는 코드 리팩토링
- `[문서]`: 문서 업데이트


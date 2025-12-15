# 중요 파일 목록

이 파일은 프로젝트에서 변경 시 특히 주의가 필요한 중요 파일들을 기록합니다.

## 📁 핵심 기능 파일

### 재고분석
- **파일**: `app/(dashboard)/seller/inventory-analysis/page.tsx`
- **설명**: 재고분석 메인 페이지
- **최근 변경**: 분석기간 부가 설명 추가 (2025-01-XX)
- **주의사항**: 분석기간 설명 텍스트가 사라지지 않도록 주의

### 원장 조회
- **파일**: 
  - `app/(dashboard)/admin/ledger/page.tsx` - 관리자용
  - `app/(dashboard)/seller/points/ledger/page.tsx` - 사용자용
- **설명**: 입금 내역 및 포인트 사용 내역 조회
- **최근 변경**: 포인트 충전 내역 → 포인트 사용 내역으로 변경 (2025-01-XX)
- **주의사항**: 통계 카드와 테이블 구조 변경됨

### 원장 API
- **파일**:
  - `app/api/admin/ledger/route.ts` - 관리자용 API
  - `app/api/user/ledger/route.ts` - 사용자용 API
- **설명**: 원장 데이터 조회 API
- **최근 변경**: 모든 거래 타입 조회하도록 수정 (charge, deduct, refund)
- **주의사항**: 통계 계산 로직 변경됨

## 🔧 설정 파일

### 패키지 관리
- **파일**: `package.json`
- **설명**: 프로젝트 의존성 관리
- **주의사항**: 의존성 추가/제거 시 주의

### Next.js 설정
- **파일**: `next.config.js`
- **설명**: Next.js 빌드 및 런타임 설정
- **주의사항**: 설정 변경 시 빌드 오류 가능

### TypeScript 설정
- **파일**: `tsconfig.json`
- **설명**: TypeScript 컴파일러 설정
- **주의사항**: 타입 체크 규칙 변경 시 영향

## 🗄️ 데이터베이스

### 마이그레이션 파일
- **경로**: `supabase/migrations/*.sql`
- **설명**: 데이터베이스 스키마 변경
- **주의사항**: 
  - 마이그레이션은 되돌리기 어려움
  - 변경 전 반드시 백업
  - 순서가 중요함

## 📝 문서 파일

### 변경 이력
- **파일**: `CHANGELOG.md`
- **설명**: 모든 변경사항 기록
- **주의사항**: 모든 변경사항을 반드시 기록

### 개발 가이드
- **파일**: `DEVELOPMENT_WORKFLOW.md`
- **설명**: 개발 프로세스 가이드
- **주의사항**: 프로세스 변경 시 업데이트 필요

## 🔄 파일 변경 시 체크리스트

다음 파일을 변경할 때는 반드시:

1. [ ] **CHANGELOG.md 업데이트**
2. [ ] **변경 전 git status 확인**
3. [ ] **변경 후 테스트**
4. [ ] **관련 문서 업데이트**
5. [ ] **커밋 메시지에 파일 경로 포함**

## 📌 파일별 변경 이력 추적

### 재고분석 페이지
```bash
# 변경 이력 확인
git log --oneline -- app/(dashboard)/seller/inventory-analysis/page.tsx

# 특정 키워드 검색
git log --all -p --grep="재고분석" -- app/(dashboard)/seller/inventory-analysis/page.tsx
```

### 원장 조회 페이지
```bash
# 관리자용 원장
git log --oneline -- app/(dashboard)/admin/ledger/page.tsx

# 사용자용 원장
git log --oneline -- app/(dashboard)/seller/points/ledger/page.tsx
```

## ⚠️ 주의가 필요한 변경 패턴

다음과 같은 변경은 이전 버전으로 되돌아갈 위험이 높습니다:

1. **대규모 리팩토링**: 여러 파일을 동시에 수정
2. **설정 파일 변경**: 빌드/런타임 설정 수정
3. **의존성 변경**: package.json 수정
4. **데이터베이스 마이그레이션**: 스키마 변경

이런 변경 시에는:
- 별도 브랜치에서 작업
- 충분한 테스트
- 단계별 커밋
- 변경사항 상세 기록












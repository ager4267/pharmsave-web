# Vercel 배포 환경에서 데이터 초기화 설정 가이드

## ⚠️ 중요 경고

**배포된 웹에서 데이터 초기화는 모든 데이터를 삭제합니다!**
- 모든 사용자 데이터가 삭제됩니다 (관리자 제외)
- 이 작업은 되돌릴 수 없습니다
- 중요한 데이터가 있다면 반드시 백업을 수행하세요

## 단계별 설정 방법

### 1단계: Vercel 대시보드 접속

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인
2. 프로젝트 선택 (`pharmsave-web` 또는 해당 프로젝트)

### 2단계: 환경 변수 설정

1. 프로젝트 페이지에서 **Settings** 클릭
2. 왼쪽 메뉴에서 **Environment Variables** 클릭
3. **Add New** 버튼 클릭
4. 다음 정보 입력:
   ```
   Name: ALLOW_TEST_DATA_RESET
   Value: true
   Environment: Production (또는 All)
   ```
5. **Save** 클릭

### 3단계: 재배포

환경 변수를 추가한 후 자동으로 재배포가 시작됩니다. 
만약 자동 재배포가 되지 않으면:

1. **Deployments** 탭으로 이동
2. 최신 배포 옆의 **...** 메뉴 클릭
3. **Redeploy** 선택

또는 Git에 커밋을 푸시하면 자동으로 재배포됩니다.

### 4단계: 데이터 초기화 실행

1. 배포 완료 후 웹사이트 접속
2. 관리자로 로그인
3. 관리자 설정 페이지로 이동
4. **테스트 데이터 초기화** 버튼 클릭
5. 확인 메시지에서 **확인** 클릭

### 5단계: 보안을 위해 환경 변수 제거 (중요!)

**데이터 초기화 완료 후 반드시 환경 변수를 제거하세요!**

1. Vercel 대시보드 → Settings → Environment Variables
2. `ALLOW_TEST_DATA_RESET` 환경 변수 찾기
3. **...** 메뉴 클릭 → **Delete** 선택
4. 확인 후 삭제

또는 값을 `false`로 변경:
```
Name: ALLOW_TEST_DATA_RESET
Value: false
```

## 대안 방법: Supabase Dashboard에서 직접 삭제

Vercel 환경 변수 설정이 번거롭다면, Supabase Dashboard에서 직접 SQL로 삭제할 수 있습니다.

### Supabase SQL Editor 사용

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. 다음 SQL 쿼리 실행:

```sql
-- 주의: 이 쿼리는 모든 테스트 데이터를 삭제합니다!
-- 관리자 계정은 보존됩니다.

BEGIN;

-- 1. 판매 승인 보고서 삭제
DELETE FROM public.sales_approval_reports;

-- 2. 구매 주문 삭제
DELETE FROM public.purchase_orders;

-- 3. 구매 요청 삭제
DELETE FROM public.purchase_requests;

-- 4. 상품 삭제
DELETE FROM public.products;

-- 5. 판매 목록 삭제
DELETE FROM public.sales_lists;

-- 6. 포인트 충전 요청 삭제 (관리자 제외)
DELETE FROM public.point_charge_requests
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 7. 포인트 거래 내역 삭제 (관리자 제외)
DELETE FROM public.point_transactions
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 8. 포인트 잔액 삭제 (관리자 제외)
DELETE FROM public.points
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 9. 사용자 삭제 (관리자 제외)
-- ⚠️ 중요: profiles를 먼저 삭제해야 합니다 (profiles가 auth.users를 참조하므로)
DELETE FROM public.profiles
WHERE role != 'admin';

DELETE FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

COMMIT;
```

**주의사항:**
- 이 쿼리는 관리자 계정을 제외한 모든 데이터를 삭제합니다
- 실행 전에 반드시 백업을 수행하세요
- `BEGIN;`과 `COMMIT;`으로 트랜잭션을 감싸서 오류 시 롤백 가능

## 현재 상태 확인

데이터 초기화 API는 다음 조건을 확인합니다:

```typescript
const isProduction = process.env.NODE_ENV === 'production'
const allowReset = process.env.ALLOW_TEST_DATA_RESET === 'true'

if (isProduction && !allowReset) {
  // 초기화 차단
}
```

**현재 상태:**
- ✅ `NODE_ENV=production` (Vercel 자동 설정)
- ❌ `ALLOW_TEST_DATA_RESET` 미설정
- ❌ 결과: 데이터 초기화 차단됨

**설정 후:**
- ✅ `NODE_ENV=production`
- ✅ `ALLOW_TEST_DATA_RESET=true`
- ✅ 결과: 데이터 초기화 허용됨

## 권장 워크플로우

1. **초기화 전:**
   - Supabase Dashboard에서 데이터베이스 백업 (선택사항)
   - Vercel 환경 변수 설정

2. **초기화 실행:**
   - 웹사이트에서 관리자로 로그인
   - 데이터 초기화 실행

3. **초기화 후:**
   - **반드시** Vercel 환경 변수 제거 또는 `false`로 변경
   - 보안을 위해 즉시 처리

## 문제 해결

### 환경 변수 설정 후에도 초기화가 안 되는 경우

1. **재배포 확인:**
   - 환경 변수 추가 후 재배포가 완료되었는지 확인
   - Vercel Deployments 탭에서 최신 배포 상태 확인

2. **환경 변수 값 확인:**
   - `ALLOW_TEST_DATA_RESET=true` (대소문자 구분)
   - `Environment: Production` 선택 확인

3. **브라우저 캐시 클리어:**
   - 브라우저 캐시를 클리어하고 새로고침

4. **콘솔 로그 확인:**
   - 브라우저 개발자 도구 콘솔에서 오류 메시지 확인

## 보안 권장사항

1. **환경 변수는 필요할 때만 활성화**
   - 초기화 후 즉시 제거

2. **프로덕션 환경에서는 비활성화 유지**
   - 실제 운영 중인 서비스에서는 절대 사용하지 마세요

3. **백업 필수**
   - 중요한 데이터는 반드시 백업

4. **권한 관리**
   - 관리자 계정만 초기화 기능에 접근 가능하도록 유지


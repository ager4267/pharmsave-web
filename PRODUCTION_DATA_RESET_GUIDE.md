# 프로덕션 환경 데이터 초기화 가이드

## ⚠️ 경고

**프로덕션 환경에서 데이터 초기화는 매우 위험합니다!**
- 모든 사용자 데이터가 삭제됩니다 (관리자 제외)
- 이 작업은 되돌릴 수 없습니다
- 실제 운영 중인 서비스에서는 절대 사용하지 마세요

## 현재 상황

Vercel에 배포된 환경(`pharmsave-web.vercel.app`)은 프로덕션 환경으로 인식되어 데이터 초기화가 기본적으로 비활성화되어 있습니다.

## 해결 방법

### 방법 1: 로컬 개발 환경에서 실행 (권장)

1. 로컬에서 프로젝트 실행:
   ```bash
   npm run dev
   ```

2. 로컬 환경(`http://localhost:3000`)에서 관리자로 로그인

3. 관리자 설정 페이지에서 테스트 데이터 초기화 실행

**장점:**
- 프로덕션 데이터에 영향을 주지 않음
- 안전하게 테스트 가능

### 방법 2: Vercel 환경 변수 설정 (주의 필요)

프로덕션 환경에서도 초기화를 허용하려면:

1. Vercel 대시보드 접속
2. 프로젝트 선택 → Settings → Environment Variables
3. 다음 환경 변수 추가:
   ```
   Name: ALLOW_TEST_DATA_RESET
   Value: true
   Environment: Production (또는 All)
   ```
4. 재배포 필요 (환경 변수 변경 후 자동 재배포 또는 수동 재배포)

**주의사항:**
- ⚠️ 이 설정을 활성화하면 프로덕션 데이터가 삭제될 수 있습니다
- 초기화 후에는 반드시 환경 변수를 제거하거나 `false`로 변경하세요
- 중요한 데이터가 있다면 반드시 백업을 수행하세요

### 방법 3: Supabase Dashboard에서 직접 삭제

1. Supabase Dashboard 접속
2. SQL Editor에서 직접 SQL 쿼리 실행
3. 더 세밀한 제어 가능

## 코드 분석

데이터 초기화 API는 다음 조건을 확인합니다:

```typescript
const isProduction = process.env.NODE_ENV === 'production'
const allowReset = process.env.ALLOW_TEST_DATA_RESET === 'true'

if (isProduction && !allowReset) {
  // 초기화 차단
}
```

**조건:**
- `NODE_ENV === 'production'` (Vercel에서 자동 설정됨)
- `ALLOW_TEST_DATA_RESET !== 'true'` (기본값: undefined/false)

**해결:**
- `ALLOW_TEST_DATA_RESET=true` 환경 변수 설정 필요

## 권장 사항

1. **개발/테스트 환경에서만 사용**
   - 로컬 개발 환경 또는 스테이징 환경에서만 실행

2. **프로덕션에서는 비활성화 유지**
   - 보안상의 이유로 프로덕션에서 데이터 초기화는 위험합니다
   - 실수로 실행될 경우 복구 불가능한 데이터 손실 발생

3. **백업 필수**
   - 초기화 전에 반드시 데이터베이스 백업 수행

4. **환경 변수 관리**
   - `ALLOW_TEST_DATA_RESET`은 필요할 때만 활성화
   - 사용 후 즉시 제거 또는 `false`로 변경

## 현재 상태 확인

현재 Vercel 환경에서:
- ✅ `NODE_ENV=production` (자동 설정)
- ❌ `ALLOW_TEST_DATA_RESET` 미설정 (기본값: undefined)
- ❌ 결과: 데이터 초기화 차단됨

## 다음 단계

1. **로컬에서 실행** (가장 안전)
   - 로컬 개발 환경에서 초기화 실행

2. **또는 Vercel 환경 변수 설정** (주의 필요)
   - Vercel 대시보드에서 `ALLOW_TEST_DATA_RESET=true` 설정
   - 초기화 실행
   - 즉시 환경 변수 제거 또는 `false`로 변경


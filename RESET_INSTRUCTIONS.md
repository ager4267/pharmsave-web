# 테스트 데이터 초기화 실행 방법

## 환경 변수 설정

초기화 스크립트를 실행하기 전에 환경 변수를 설정해야 합니다.

### 방법 1: .env.local 파일 생성 (권장)

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**환경 변수 확인 방법:**
1. Supabase Dashboard 접속
2. Settings → API 메뉴로 이동
3. **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`에 사용
4. **service_role key (secret)**: `SUPABASE_SERVICE_ROLE_KEY`에 사용

⚠️ **주의**: Service Role Key는 절대 공개되면 안 되는 비밀 키입니다!

### 방법 2: PowerShell에서 환경 변수로 직접 설정

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
node scripts/reset-test-data.js
```

### 방법 3: CMD에서 환경 변수로 직접 설정

```cmd
set NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
node scripts/reset-test-data.js
```

## 초기화 실행

환경 변수를 설정한 후 다음 명령어를 실행하세요:

```bash
npm run reset:test-data
```

또는

```bash
node scripts/reset-test-data.js
```

## 초기화 과정

1. 관리자 계정 확인
2. 삭제 대상 사용자 확인
3. 관련 데이터 삭제 (외래키 제약조건 고려)
4. 결과 요약 출력

## 주의사항

- ⚠️ 이 작업은 **되돌릴 수 없습니다**
- 관리자 계정은 **보존**됩니다
- Supabase Auth 사용자(`auth.users`)는 별도로 삭제해야 합니다




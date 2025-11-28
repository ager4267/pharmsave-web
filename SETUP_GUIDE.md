# 다른 PC에서 프로젝트 설정 가이드

이 문서는 다른 PC에서 이 프로젝트를 이어서 작업하기 위한 설정 가이드입니다.

## 📋 사전 준비사항

### 1. 필수 소프트웨어 설치
- **Node.js** 18.x 이상 ([다운로드](https://nodejs.org/))
- **npm** (Node.js와 함께 설치됨)
- **Git** (선택사항, 코드 버전 관리용)

### 2. 현재 PC에서 준비할 것
- 프로젝트 코드 (전체 폴더)
- Supabase 연결 정보 (URL, API 키)
- 환경 변수 파일 (`.env.local`)

---

## 🚀 설정 단계

### 1단계: 프로젝트 코드 가져오기

#### 방법 A: Git 사용 (권장)
```bash
# 새 PC에서
git clone <저장소_URL>
cd web_sub1
```

#### 방법 B: 파일 복사
1. 현재 PC의 `web_sub1` 폴더 전체를 USB나 클라우드 드라이브로 복사
2. 새 PC의 원하는 위치에 붙여넣기

---

### 2단계: 환경 변수 파일 생성

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

#### Supabase 정보 확인 방법:
1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로젝트 `web_sub1` 선택
3. Settings → API 메뉴로 이동

#### 현재 프로젝트 정보:
- **프로젝트 URL**: `https://duopazxljjcebdmeymax.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3BhenhsampjZWJkbWV5bWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MzA4NjQsImV4cCI6MjA3ODUwNjg2NH0._zors_IO36b5DqJWEsWYpvuN3fG-8kFXE2IYyr6M3dM`
- **Service Role Key**: Settings → API에서 확인 필요
4. 다음 정보를 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** 키 → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 비밀 유지)

> ⚠️ **중요**: `.env.local` 파일은 **Git에 업로드되지 않습니다**. `.gitignore` 파일에 이미 포함되어 있어서 Git이 이 파일을 무시하도록 설정되어 있습니다. 따라서 각 PC에서 직접 생성해야 합니다.

---

### 3단계: 의존성 설치

```bash
# 프로젝트 폴더로 이동
cd web_sub1

# npm 패키지 설치
npm install
```

설치가 완료되면 `node_modules` 폴더가 생성됩니다.

---

### 4단계: 데이터베이스 마이그레이션 확인

프로젝트는 Supabase 클라우드를 사용하므로, 마이그레이션이 이미 적용되어 있을 수 있습니다.

#### 마이그레이션 확인:
1. Supabase 대시보드 → Database → Migrations
2. 다음 마이그레이션이 있는지 확인:
   - `001_initial_schema.sql`
   - `002_sales_approval_reports.sql`

#### 마이그레이션이 없다면:
Supabase 대시보드 → SQL Editor에서 다음 파일들을 순서대로 실행:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_sales_approval_reports.sql`

---

### 5단계: 개발 서버 실행

```bash
npm run dev
```

서버가 시작되면 브라우저에서 다음 주소로 접속:
- **http://localhost:3000**

---

## ✅ 확인 사항

### 정상 작동 확인:
1. ✅ 서버가 정상적으로 시작되는가?
2. ✅ 로그인 페이지가 표시되는가?
3. ✅ 데이터베이스 연결이 정상인가? (로그인 시도)

### 문제 해결:

#### 오류: "NEXT_PUBLIC_SUPABASE_URL is not defined"
- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- 파일 이름이 정확한지 확인 (`.env.local`)
- 서버를 재시작 (`Ctrl+C` 후 `npm run dev`)

#### 오류: "Cannot find module"
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

#### 오류: "Database connection failed"
- Supabase URL과 키가 정확한지 확인
- Supabase 프로젝트가 활성화되어 있는지 확인
- 인터넷 연결 확인

---

## 📁 중요한 파일 목록

다음 파일들은 반드시 새 PC에 있어야 합니다:

### 필수 파일:
- ✅ `package.json` - 의존성 정보
- ✅ `.env.local` - 환경 변수 (직접 생성 필요)
- ✅ `supabase/migrations/` - 데이터베이스 마이그레이션
- ✅ `app/` - 애플리케이션 코드
- ✅ `lib/` - 유틸리티 및 설정
- ✅ `components/` - React 컴포넌트

### 자동 생성 파일 (설치 후 생성됨):
- `node_modules/` - npm 패키지
- `.next/` - Next.js 빌드 파일
- `package-lock.json` - 패키지 잠금 파일

---

## 🔄 업데이트 가져오기

다른 PC에서 작업한 내용을 가져오려면:

```bash
# Git 사용 시
git pull origin main

# 또는 파일 복사 후
npm install  # 새로운 패키지가 있다면
```

---

## 💡 팁

1. **환경 변수 백업**: `.env.local` 파일을 안전한 곳에 백업해두세요 (비밀번호 관리자 등)
2. **Supabase 연결**: 같은 Supabase 프로젝트를 사용하면 데이터가 공유됩니다
3. **포트 충돌**: 3000번 포트가 사용 중이면 자동으로 다른 포트를 사용합니다

---

## 📞 추가 도움이 필요하신가요?

문제가 발생하면:
1. 터미널 오류 메시지 확인
2. 브라우저 콘솔 오류 확인 (F12)
3. `.env.local` 파일 설정 확인


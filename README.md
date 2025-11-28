# 팜세이브 (PharmSave)

도매사 불용재고 중개 플랫폼 - B2B 의약품 세이브 마켓

의약품 도매업체 간 불용재고와 유효기간 임박 재고를 안전하고 투명하게 거래할 수 있는 B2B 전자상거래 플랫폼입니다.

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **백엔드**: Supabase (PostgreSQL, Auth, Storage)
- **상태 관리**: Zustand
- **데이터 페칭**: React Query
- **엑셀 처리**: xlsx
- **차트**: recharts

## 시작하기

### 필수 요구사항

- Node.js 18.x 이상
- npm 또는 yarn
- Docker (Supabase 로컬 실행용, 선택사항)

### 다른 PC에서 프로젝트 설정하기

다른 PC에서 이 프로젝트를 이어서 작업하려면 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** 파일을 참고하세요.

**빠른 설정 요약:**
1. 프로젝트 코드 복사 또는 Git clone
2. `.env.local` 파일 생성 (Supabase 연결 정보 입력)
3. `npm install` 실행
4. `npm run dev` 실행

### 설치

```bash
# 패키지 설치
npm install

# 환경 변수 설정
# 프로젝트 루트에 .env.local 파일을 생성하고 다음 내용을 입력하세요:
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Supabase 설정

#### 옵션 1: 로컬 Supabase 사용 (권장)

```bash
# Supabase CLI 설치
npm install -g supabase

# Supabase 초기화
supabase init

# 로컬 Supabase 시작
supabase start

# 환경 변수 확인
supabase status
# 출력된 정보에서 anon key와 service_role key를 .env.local에 입력
```

#### 옵션 2: 클라우드 Supabase 사용

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. 프로젝트 설정에서 API URL과 키 확인
3. `.env.local` 파일에 입력

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 프로젝트 구조

```
pharmaceutical-marketplace/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 인증 관련 페이지
│   ├── (dashboard)/       # 대시보드 페이지
│   └── api/               # API Routes
├── lib/                   # 유틸리티 및 설정
│   ├── supabase/         # Supabase 클라이언트
│   ├── utils/            # 유틸리티 함수
│   └── types/            # TypeScript 타입
├── components/            # React 컴포넌트
├── supabase/             # Supabase 설정
│   └── migrations/       # 데이터베이스 마이그레이션
└── public/               # 정적 파일
```

## 주요 기능

- ✅ 회원가입 및 인증 (도매업 허가증 검증)
- ✅ 판매 리스트 제출
- ✅ 상품 등록 (관리자)
- ✅ 구매 요청 제출
- ✅ 매입-재판매 프로세스
- ✅ 수수료 계산 (5%)
- ✅ 보험가 및 할인율 표시
- ✅ 불용 재고 및 유효기간 임박 재고 파악

## 주요 SQL 파일

- `supabase/migrations/001_initial_schema.sql` - 데이터베이스 스키마 마이그레이션
- `FIX_PROFILE_CREATION_FINAL.sql` - 프로필 생성 트리거 및 RLS 정책 설정
- `COMPLETE_SETUP_ALL.sql` - 전체 설정 한 번에 실행 (관리자 설정 페이지에서 참조)
- `FIX_INFINITE_RECURSION_FINAL.sql` - 무한 재귀 오류 해결
- `FIX_STORAGE_RLS_COMPLETE.sql` - Storage RLS 정책 설정
- `storage_policies.sql` - Storage 정책 (간단한 버전)

## 라이선스

MIT


# 공지사항 팝업 기능 분석 및 구현 계획

## 현재 구조 분석

### 1. 홈페이지 구조
- **파일 위치**: `app/page.tsx`
- **특징**: 클라이언트 컴포넌트, 로그인 상태 확인 후 자동 리다이렉트
- **팝업 추가 가능성**: ✅ 가능 (useEffect에서 공지사항 조회 및 팝업 표시)

### 2. 관리자 메뉴 구조
- **대시보드**: `app/(dashboard)/admin/dashboard/page.tsx`
- **기존 메뉴들**:
  - 사용자 관리
  - 회원 가입 승인
  - 상품 관리
  - 판매 리스트
  - 구매 요청
  - 판매 승인 보고서
  - 시스템 설정 (`/admin/settings`)
  - 포인트 관리
  - 포인트 충전 요청

### 3. 관리자 메뉴 추가 가능성
- ✅ **가능**: 관리자 대시보드에 "공지사항 관리" 메뉴 추가 가능
- ✅ **권장 위치**: 
  1. 관리자 대시보드의 "빠른 작업" 섹션에 추가
  2. 또는 별도 페이지 생성: `/admin/announcements`

## 구현 계획

### 1. 데이터베이스 스키마

```sql
-- 공지사항 테이블 생성
CREATE TABLE public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    show_on_homepage BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- 우선순위 (높을수록 먼저 표시)
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- 만료일 (선택사항)
);

-- RLS 정책
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 활성화된 공지사항 조회 가능
CREATE POLICY "Anyone can view active announcements"
    ON public.announcements
    FOR SELECT
    USING (is_active = true AND show_on_homepage = true);

-- 관리자만 공지사항 관리 가능
CREATE POLICY "Admins can manage announcements"
    ON public.announcements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
```

### 2. 관리자 페이지 구조

#### 옵션 1: 시스템 설정 페이지에 추가
- **위치**: `app/(dashboard)/admin/settings/page.tsx`
- **장점**: 기존 페이지 활용
- **단점**: 설정 페이지가 복잡해질 수 있음

#### 옵션 2: 별도 공지사항 관리 페이지 생성 (권장)
- **위치**: `app/(dashboard)/admin/announcements/page.tsx`
- **기능**:
  - 공지사항 목록 조회
  - 공지사항 생성/수정/삭제
  - 활성화/비활성화 토글
  - 홈페이지 표시 여부 설정
  - 우선순위 설정

### 3. 홈페이지 팝업 구현

#### 기능 요구사항:
1. ✅ 활성화된 공지사항 조회
2. ✅ 로컬 스토리지로 "오늘 하루 보지 않기" 기능
3. ✅ 모달/팝업 UI
4. ✅ 여러 공지사항이 있을 경우 우선순위에 따라 표시

#### 구현 위치:
- `app/page.tsx`에 `useEffect`로 공지사항 조회
- 팝업 컴포넌트 생성: `components/AnnouncementPopup.tsx`

### 4. API 라우트

필요한 API:
- `GET /api/announcements` - 활성화된 공지사항 조회
- `GET /api/admin/announcements` - 관리자용 전체 공지사항 조회
- `POST /api/admin/announcements` - 공지사항 생성
- `PUT /api/admin/announcements/[id]` - 공지사항 수정
- `DELETE /api/admin/announcements/[id]` - 공지사항 삭제

## 구현 단계

### Phase 1: 데이터베이스 및 기본 구조
1. 마이그레이션 파일 생성 (`supabase/migrations/008_announcements.sql`)
2. 공지사항 타입 정의 (`lib/types/index.ts`)

### Phase 2: 관리자 페이지
1. 공지사항 관리 페이지 생성 (`app/(dashboard)/admin/announcements/page.tsx`)
2. 관리자 대시보드에 메뉴 링크 추가
3. API 라우트 생성

### Phase 3: 홈페이지 팝업
1. 팝업 컴포넌트 생성 (`components/AnnouncementPopup.tsx`)
2. 홈페이지에 팝업 통합
3. 로컬 스토리지 연동

## 예상 작업 시간
- 데이터베이스 스키마: 30분
- 관리자 페이지: 2-3시간
- 홈페이지 팝업: 1-2시간
- API 라우트: 1시간
- **총 예상 시간**: 4-6시간

## 결론

✅ **구현 가능**: 모든 기능이 구현 가능하며, 기존 구조와 잘 통합됩니다.

**권장 사항**:
1. 별도 공지사항 관리 페이지 생성 (`/admin/announcements`)
2. 관리자 대시보드의 "빠른 작업" 섹션에 링크 추가
3. 홈페이지 팝업은 모달 형태로 구현
4. "오늘 하루 보지 않기" 기능으로 사용자 경험 개선




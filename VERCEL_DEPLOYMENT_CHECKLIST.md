# Vercel 배포 확인 체크리스트

## 🔍 1. Git 연동 확인

### Vercel 대시보드에서 확인
1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **Settings** → **Git** 메뉴 확인
4. 다음 사항 확인:
   - ✅ Git Repository가 연결되어 있는지
   - ✅ 올바른 브랜치(`master` 또는 `main`)가 선택되어 있는지
   - ✅ Production Branch가 올바르게 설정되어 있는지

### 확인 방법
```bash
# 로컬에서 원격 저장소 확인
git remote -v
# 출력 예시:
# origin  https://github.com/ager4267/pharmsave-web.git (fetch)
# origin  https://github.com/ager4267/pharmsave-web.git (push)
```

## 🔍 2. 자동 배포 설정 확인

### Vercel 대시보드에서 확인
1. **Settings** → **Git** 메뉴
2. **Deploy Hooks** 또는 **Automatic Deployments** 확인
3. 다음 옵션이 활성화되어 있는지 확인:
   - ✅ **Automatic deployments from Git** (활성화)
   - ✅ **Production Branch**: `master` 또는 `main`

### 수동 배포 확인
1. **Deployments** 탭으로 이동
2. 최신 배포 상태 확인:
   - ✅ **Ready**: 배포 완료
   - ⏳ **Building**: 배포 중
   - ❌ **Error**: 배포 실패 (로그 확인 필요)

## 🔍 3. 빌드 설정 확인

### Vercel 대시보드에서 확인
1. **Settings** → **General** 메뉴
2. **Build & Development Settings** 확인:
   - ✅ **Framework Preset**: Next.js
   - ✅ **Build Command**: `npm run build` (또는 자동 감지)
   - ✅ **Output Directory**: `.next` (또는 자동 감지)
   - ✅ **Install Command**: `npm install` (또는 자동 감지)
   - ✅ **Root Directory**: `/` (프로젝트 루트)

### package.json 확인
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

## 🔍 4. 환경 변수 확인

### 필수 환경 변수
Vercel 대시보드 → **Settings** → **Environment Variables**에서 다음 변수들이 설정되어 있는지 확인:

#### 필수 변수
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (서버 사이드용)

#### 환경별 설정 확인
각 환경(Production, Preview, Development)에 올바르게 설정되어 있는지 확인:
- **Production**: 프로덕션 환경 변수
- **Preview**: 프리뷰 환경 변수 (선택사항)
- **Development**: 개발 환경 변수 (선택사항)

### 환경 변수 확인 방법
```bash
# 로컬에서 .env.local 파일 확인 (참고용)
# Vercel에서는 대시보드에서만 확인 가능
```

## 🔍 5. 최근 배포 로그 확인

### Vercel 대시보드에서 확인
1. **Deployments** 탭으로 이동
2. 최신 배포 클릭
3. **Build Logs** 확인:
   - ✅ 빌드가 성공적으로 완료되었는지
   - ❌ 에러 메시지가 있는지 확인

### 일반적인 빌드 에러
- **Module not found**: 의존성 설치 문제
- **Environment variable missing**: 환경 변수 누락
- **Build timeout**: 빌드 시간 초과
- **TypeScript errors**: 타입 에러

## 🔍 6. 최근 커밋 반영 확인

### Git 커밋 확인
```bash
# 최근 커밋 확인
git log --oneline -5

# 원격 저장소와 동기화 확인
git status
```

### Vercel에서 확인
1. **Deployments** 탭에서 최신 배포 확인
2. **Commit** 컬럼에서 커밋 해시 확인
3. GitHub의 커밋 해시와 일치하는지 확인

### 커밋이 반영되지 않는 경우
1. **수동 재배포**:
   - Vercel 대시보드 → **Deployments** → 최신 배포 → **...** → **Redeploy**
2. **Git 푸시 확인**:
   ```bash
   git push origin master
   ```

## 🔍 7. Next.js 설정 확인

### next.config.js 확인
최근 변경사항이 빌드에 영향을 주는지 확인:
- ✅ 이미지 최적화 설정
- ✅ 웹팩 설정
- ✅ 실험적 기능 설정

### 빌드 테스트 (로컬)
```bash
# 로컬에서 빌드 테스트
npm run build

# 빌드 성공 시
npm start
```

## 🔍 8. 프로젝트 연결 확인

### Vercel 프로젝트 확인
1. Vercel 대시보드에서 프로젝트 목록 확인
2. 올바른 프로젝트가 선택되어 있는지 확인
3. 프로젝트 URL 확인:
   - Production: `https://your-project.vercel.app`
   - Custom Domain: 설정된 도메인

## 🔍 9. 성능 최적화 변경사항 확인

### 최근 적용된 최적화
다음 변경사항들이 Vercel에 반영되었는지 확인:

1. **next.config.js 변경사항**:
   - 이미지 최적화 설정
   - 웹팩 번들 스플리팅
   - SWC Minify 설정

2. **동적 임포트**:
   - `app/(dashboard)/seller/inventory-analysis/page.tsx`
   - Recharts, XLSX 동적 로딩

3. **React Query 설정**:
   - `lib/providers/query-provider.tsx`

4. **폰트 최적화**:
   - `app/layout.tsx`

### 확인 방법
1. Vercel 배포 로그에서 빌드 성공 확인
2. 배포된 사이트에서 성능 개선 확인
3. Chrome DevTools → Network 탭에서 번들 크기 확인

## 🔍 10. 즉시 확인해야 할 사항

### 우선순위 높음
1. ✅ **최신 커밋이 푸시되었는지 확인**
   ```bash
   git log origin/master -1
   ```

2. ✅ **Vercel 배포 로그 확인**
   - Deployments 탭 → 최신 배포 → Build Logs

3. ✅ **환경 변수 확인**
   - Settings → Environment Variables

4. ✅ **빌드 에러 확인**
   - 빌드 실패 시 에러 메시지 확인

### 우선순위 중간
5. ✅ **자동 배포 설정 확인**
   - Git 연동 상태
   - Production Branch 설정

6. ✅ **로컬 빌드 테스트**
   - `npm run build` 성공 여부

## 🚀 문제 해결 단계

### 1단계: 기본 확인
- [ ] Git 푸시 완료 확인
- [ ] Vercel 대시보드 접속 가능
- [ ] 프로젝트 선택 확인

### 2단계: 배포 상태 확인
- [ ] Deployments 탭에서 최신 배포 확인
- [ ] 배포 상태 (Ready/Error/Building) 확인
- [ ] 빌드 로그 확인

### 3단계: 설정 확인
- [ ] Git 연동 확인
- [ ] 환경 변수 확인
- [ ] 빌드 설정 확인

### 4단계: 수동 재배포
- [ ] 최신 배포 → Redeploy 클릭
- [ ] 또는 Git에 빈 커밋 푸시:
  ```bash
  git commit --allow-empty -m "trigger redeploy"
  git push
  ```

## 📝 체크리스트 요약

```
□ Git 푸시 완료
□ Vercel Git 연동 확인
□ 자동 배포 설정 확인
□ 환경 변수 설정 확인
□ 빌드 로그 확인 (에러 없음)
□ 최신 커밋 반영 확인
□ 로컬 빌드 테스트 성공
□ 배포된 사이트 접속 확인
```

## 🔗 유용한 링크

- [Vercel 대시보드](https://vercel.com/dashboard)
- [Vercel 문서 - 배포](https://vercel.com/docs/concepts/deployments)
- [Vercel 문서 - 환경 변수](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)


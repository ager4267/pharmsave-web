# 개발 워크플로우 가이드

이 문서는 기능 수정 시 이전 버전으로 되돌아가는 것을 예방하기 위한 개발 프로세스를 설명합니다.

## 📋 개발 전 체크리스트

### 1. 현재 상태 확인
```bash
# 현재 브랜치 확인
git branch

# 최신 변경사항 확인
git status

# 최근 커밋 확인
git log --oneline -5
```

### 2. 작업 전 백업
```bash
# 현재 작업 브랜치에서 백업 브랜치 생성
git checkout -b backup/작업명-YYYYMMDD

# 원래 브랜치로 돌아가기
git checkout master
```

## 🔄 기능 수정 프로세스

### Step 1: 작업 브랜치 생성
```bash
# 기능별 브랜치 생성 (권장)
git checkout -b feature/기능명-간단설명

# 예시:
git checkout -b feature/ledger-point-usage
git checkout -b fix/inventory-analysis-description
```

### Step 2: 변경사항 작업
- 코드 수정
- 테스트
- 문서 업데이트

### Step 3: 변경사항 기록
1. **CHANGELOG.md 업데이트**
   ```markdown
   ## YYYY-MM-DD
   ### [수정] 기능명
   - 파일: app/path/to/file.tsx
   - 설명: 변경 내용 상세 설명
   ```

2. **커밋 메시지 작성**
   ```bash
   git add .
   git commit -m "[수정] 기능명: 변경 내용 설명

   - 변경된 파일 목록
   - 주요 변경 사항
   - 관련 이슈 번호 (있는 경우)"
   ```

### Step 4: 변경사항 확인
```bash
# 변경된 파일 확인
git status

# 변경 내용 확인
git diff

# 커밋 전 최종 확인
git log --oneline -3
```

### Step 5: 커밋 및 푸시
```bash
# 변경사항 커밋
git add .
git commit -m "상세한 커밋 메시지"

# 원격 저장소에 푸시
git push origin 브랜치명
```

## 🛡️ 이전 버전으로 되돌아가는 것 방지

### 1. Git 히스토리 관리
```bash
# 커밋 전 항상 확인
git status
git diff

# 잘못된 커밋 방지
git commit --amend  # 마지막 커밋 수정
```

### 2. 파일별 변경 추적
- **중요 파일 목록 관리**: `IMPORTANT_FILES.md` 파일 생성
- **변경 전 스냅샷**: 중요한 파일은 변경 전 복사본 보관

### 3. 코드 리뷰 체크리스트
변경사항 커밋 전 확인:
- [ ] 변경된 모든 파일 확인
- [ ] CHANGELOG.md 업데이트
- [ ] 관련 문서 업데이트
- [ ] 테스트 실행 (가능한 경우)
- [ ] 린터 오류 확인

### 4. 배포 전 최종 확인
```bash
# 최근 변경사항 확인
git log --oneline -10

# 특정 파일의 변경 이력 확인
git log --oneline -- app/path/to/file.tsx

# 변경사항 요약
git diff HEAD~1 HEAD
```

## 📝 중요 파일 목록

다음 파일들은 변경 시 특히 주의가 필요합니다:

### 핵심 기능 파일
- `app/(dashboard)/seller/inventory-analysis/page.tsx` - 재고분석
- `app/(dashboard)/admin/ledger/page.tsx` - 관리자 원장
- `app/(dashboard)/seller/points/ledger/page.tsx` - 사용자 원장
- `app/api/admin/ledger/route.ts` - 원장 API
- `app/api/user/ledger/route.ts` - 사용자 원장 API

### 설정 파일
- `package.json` - 의존성
- `next.config.js` - Next.js 설정
- `tailwind.config.ts` - Tailwind 설정
- `tsconfig.json` - TypeScript 설정

### 데이터베이스
- `supabase/migrations/*.sql` - 마이그레이션 파일

## 🔍 변경사항 확인 방법

### 특정 기능의 변경 이력 확인
```bash
# 파일별 변경 이력
git log --oneline -- app/path/to/file.tsx

# 특정 키워드로 검색
git log --all --grep="원장"
git log --all --grep="재고분석"
```

### 변경 전후 비교
```bash
# 두 커밋 간 차이
git diff 커밋1 커밋2

# 특정 파일만 비교
git diff 커밋1 커밋2 -- app/path/to/file.tsx
```

## ⚠️ 문제 발생 시 복구 방법

### 1. 최근 커밋 취소 (아직 푸시 안 함)
```bash
# 마지막 커밋 취소 (변경사항 유지)
git reset --soft HEAD~1

# 마지막 커밋 취소 (변경사항 삭제)
git reset --hard HEAD~1
```

### 2. 특정 파일만 이전 버전으로 복구
```bash
# 특정 커밋의 파일로 복구
git checkout 커밋해시 -- app/path/to/file.tsx
```

### 3. 전체 프로젝트 이전 버전으로 복구
```bash
# 특정 커밋으로 이동 (임시)
git checkout 커밋해시

# 특정 커밋으로 리셋 (주의!)
git reset --hard 커밋해시
```

## 📌 권장 사항

1. **작은 단위로 커밋**: 한 번에 하나의 기능만 수정하고 커밋
2. **명확한 커밋 메시지**: 무엇을 왜 변경했는지 명확히 기록
3. **정기적인 백업**: 중요한 변경 전에는 백업 브랜치 생성
4. **변경사항 문서화**: CHANGELOG.md에 모든 변경사항 기록
5. **코드 리뷰**: 가능하면 다른 사람과 코드 리뷰 진행

## 🚀 빠른 참조

### 일일 작업 플로우
```bash
# 1. 최신 상태로 업데이트
git pull origin master

# 2. 작업 브랜치 생성
git checkout -b feature/작업명

# 3. 작업 수행
# ... 코드 수정 ...

# 4. 변경사항 확인
git status
git diff

# 5. 커밋
git add .
git commit -m "[수정] 작업 내용"

# 6. 푸시
git push origin feature/작업명
```

### 주간 점검
```bash
# 최근 변경사항 확인
git log --oneline --since="1 week ago"

# 변경된 파일 목록
git log --since="1 week ago" --name-only --pretty=format:"%h %s"
```
















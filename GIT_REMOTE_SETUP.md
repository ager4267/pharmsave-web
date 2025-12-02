# Git 원격 저장소 연결 가이드

## 현재 상태
- 로컬 Git 저장소: `C:\cursor_A\web_sub1`
- 브랜치: `master`
- 커밋 수: 2개

## 원격 저장소 연결 방법

### 방법 1: GitHub 사용 (권장)

#### 1단계: GitHub 저장소 생성
1. GitHub.com에 로그인
2. 우측 상단의 "+" 버튼 클릭 → "New repository"
3. 저장소 이름 입력 (예: `pharmsave-web`)
4. Public 또는 Private 선택
5. "Initialize this repository with a README" 체크 해제 (이미 로컬에 코드가 있으므로)
6. "Create repository" 클릭

#### 2단계: 원격 저장소 연결
```bash
# 원격 저장소 추가
git remote add origin https://github.com/[사용자명]/[저장소명].git

# 또는 SSH 사용 시
git remote add origin git@github.com:[사용자명]/[저장소명].git
```

#### 3단계: 코드 푸시
```bash
# 첫 푸시
git push -u origin master

# 또는 main 브랜치 사용 시
git branch -M main
git push -u origin main
```

### 방법 2: GitLab 사용

#### 1단계: GitLab 저장소 생성
1. GitLab.com에 로그인
2. "New project" 클릭
3. "Create blank project" 선택
4. 프로젝트 이름 입력
5. Visibility 레벨 선택
6. "Initialize repository with a README" 체크 해제
7. "Create project" 클릭

#### 2단계: 원격 저장소 연결
```bash
git remote add origin https://gitlab.com/[사용자명]/[저장소명].git
```

#### 3단계: 코드 푸시
```bash
git push -u origin master
```

### 방법 3: 기존 원격 저장소 URL 사용

이미 원격 저장소 URL이 있는 경우:
```bash
git remote add origin [원격저장소URL]
git push -u origin master
```

## 원격 저장소 확인
```bash
# 원격 저장소 목록 확인
git remote -v

# 원격 저장소 정보 확인
git remote show origin
```

## 주의사항
- `.env` 파일 등 민감한 정보는 `.gitignore`에 포함되어 있는지 확인
- `node_modules`는 이미 `.gitignore`에 포함되어 있음
- 첫 푸시 전에 `.gitignore` 확인 권장






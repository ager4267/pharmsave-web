# Supabase 비밀번호 재설정 설정 가이드

## ✅ 자동 설정 완료

프로젝트 정보:
- **프로젝트 ID**: `duopazxljjcebdmeymax`
- **프로젝트 URL**: `https://duopazxljjcebdmeymax.supabase.co`
- **프로젝트 이름**: `web_sub1`

## 🔧 Supabase 대시보드에서 설정하기

### 1. Redirect URLs 설정

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로젝트 `web_sub1` 선택
3. **Authentication** → **URL Configuration** 메뉴로 이동
4. **Redirect URLs** 섹션에서 다음 URL들을 추가:

#### 개발 환경 (로컬)
```
http://localhost:3000/reset-password
http://localhost:3000/auth/callback
```

#### 프로덕션 환경 (배포 후)
```
https://yourdomain.com/reset-password
https://yourdomain.com/auth/callback
```

5. **Save** 버튼 클릭

### 2. 이메일 템플릿 확인

1. **Authentication** → **Email Templates** 메뉴로 이동
2. **Reset Password** 템플릿이 활성화되어 있는지 확인
3. 필요시 템플릿 커스터마이징 가능

### 3. SMTP 설정 (선택사항)

기본적으로 Supabase의 이메일 서비스를 사용하지만, 커스텀 SMTP를 사용하려면:

1. **Authentication** → **SMTP Settings** 메뉴로 이동
2. SMTP 서버 정보 입력 (Gmail, SendGrid 등)
3. **Save** 버튼 클릭

## 📧 이메일 템플릿 예시

비밀번호 재설정 이메일에는 다음 링크가 포함됩니다:
```
{{ .ConfirmationURL }}
```

이 링크는 자동으로 `/reset-password` 페이지로 리다이렉트됩니다.

## ✅ 설정 확인

설정이 완료되면:

1. 로그인 페이지에서 "비밀번호를 잊으셨나요?" 클릭
2. 이메일 입력 후 "비밀번호 재설정 링크 전송" 클릭
3. 이메일 확인
4. 링크 클릭하여 비밀번호 재설정

## 🔍 문제 해결

### 이메일이 오지 않는 경우
- 스팸 폴더 확인
- Supabase 대시보드의 **Logs** → **Auth Logs**에서 이메일 전송 상태 확인
- SMTP 설정 확인

### 리다이렉트 오류가 발생하는 경우
- Redirect URLs에 정확한 URL이 추가되었는지 확인
- URL에 `http://` 또는 `https://`가 포함되어 있는지 확인
- 프로토콜과 도메인이 정확한지 확인

## 📝 참고

- Supabase는 기본적으로 이메일 인증을 사용합니다
- 비밀번호 재설정 링크는 1시간 후 만료됩니다
- 같은 이메일로 여러 번 요청하면 가장 최근 링크만 유효합니다


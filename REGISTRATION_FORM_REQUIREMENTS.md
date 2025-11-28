# 회원가입 양식 필수 요구사항

## 중요: 이 문서는 회원가입 양식의 필수 요구사항을 정의합니다.

### 필수 입력 필드
다음 필드들은 **반드시 필수 입력**으로 설정되어야 합니다:

1. **이메일** (`email`) - 필수
2. **비밀번호** (`password`) - 필수
3. **비밀번호 확인** (`confirmPassword`) - 필수
4. **회사명** (`company_name`) - 필수
5. **사업자등록번호** (`business_number`) - 필수
6. **전화번호** (`phone_number`) - **필수** ⚠️
7. **주소** (`address`) - **필수** ⚠️
8. **계좌번호** (`account_number`) - **필수** ⚠️

### 선택 입력 필드
- **도매업 허가증 번호** (`wholesale_license`) - 선택사항

## 구현 체크리스트

### 1. `app/(auth)/register/page.tsx` 파일 확인사항

#### formData 상태에 포함되어야 할 필드:
```typescript
const [formData, setFormData] = useState({
  email: '',
  password: '',
  confirmPassword: '',
  company_name: '',
  business_number: '',
  wholesale_license: '',
  phone_number: '',        // ✅ 필수
  address: '',              // ✅ 필수
  account_number: '',       // ✅ 필수
})
```

#### 필수 필드 검증:
```typescript
if (!formData.email || !formData.password || !formData.company_name || 
    !formData.business_number || !formData.phone_number || 
    !formData.address || !formData.account_number) {
  setError('필수 항목을 모두 입력해주세요.')
  return
}
```

#### UI에 필수 표시:
- 전화번호: `<span className="text-red-500">*</span>` 추가
- 주소: `<span className="text-red-500">*</span>` 추가
- 계좌번호: `<span className="text-red-500">*</span>` 추가
- 각 필드에 `required` 속성 추가

#### API 호출 시 전달:
```typescript
body: JSON.stringify({
  userId: userId,
  adminUserId: userId,
  companyName: formData.company_name.trim(),
  businessNumber: formData.business_number.replace(/-/g, ''),
  phoneNumber: formData.phone_number?.trim() || null,
  address: formData.address?.trim() || null,
  accountNumber: formData.account_number?.trim() || null,  // ✅ 필수
}),
```

### 2. `app/api/admin/update-profile/route.ts` 파일 확인사항

#### 파라미터 수신:
```typescript
const phoneNumber = body.phoneNumber || body.phone_number
const address = body.address
const accountNumber = body.accountNumber || body.account_number  // ✅ 필수
```

#### 필수 필드 검증:
```typescript
if (!companyName || !businessNumber || !phoneNumber || 
    !address || !accountNumber) {
  return NextResponse.json(
    { success: false, error: '회사명, 사업자등록번호, 전화번호, 주소, 계좌번호는 필수 항목입니다.' },
    { status: 400 }
  )
}
```

#### 데이터베이스 저장:
```typescript
const updateData: any = {
  company_name: companyName,
  business_number: businessNumber,
  phone_number: phoneNumber,      // ✅ 필수
  address: address,               // ✅ 필수
  account_number: accountNumber,  // ✅ 필수
  updated_at: new Date().toISOString(),
}
```

## 문제 발생 가능 시나리오

1. **Git 버전 관리 없음**: 파일이 실수로 덮어씌워질 수 있음
2. **파일 복원 시**: 이전 버전으로 복원되면 필수 필드가 누락될 수 있음
3. **병합 충돌**: Git 병합 시 잘못된 버전이 선택될 수 있음
4. **배포 과정**: 이전 버전이 배포될 수 있음
5. **수동 편집**: 실수로 필드를 삭제하거나 주석 처리할 수 있음

## 방지 방법

1. **Git 저장소 초기화 및 정기 커밋**
   ```bash
   git init
   git add .
   git commit -m "회원가입 양식 필수 필드 구현 완료"
   ```

2. **이 문서를 참고하여 변경사항 확인**
   - 회원가입 양식을 수정할 때마다 이 문서의 체크리스트 확인

3. **테스트 자동화** (선택사항)
   - 회원가입 양식의 필수 필드 검증 테스트 작성

4. **코드 리뷰**
   - 회원가입 관련 파일 수정 시 이 문서 기준으로 검토

## 마지막 업데이트
- 날짜: 2025-01-27
- 버전: 1.0
- 상태: ✅ 모든 필수 필드 구현 완료


# 테스트 데이터 초기화 가이드

웹사이트 테스트를 위해 관리자를 제외한 모든 사용자 데이터와 관련 데이터를 초기화하는 방법입니다.

## ⚠️ 주의사항

- **이 기능은 개발/테스트 환경에서만 사용해야 합니다.**
- 프로덕션 환경에서는 데이터 초기화가 기본적으로 비활성화되어 있습니다.
- 초기화 전에 중요한 데이터가 있다면 백업을 수행하세요.
- 관리자 계정은 초기화되지 않습니다.

## 초기화 대상 데이터

다음 데이터가 삭제됩니다 (관리자 제외):

1. **사용자 관련**
   - 사용자 프로필 (profiles)
   - Supabase Auth 사용자 (auth.users) - 별도 처리 필요

2. **판매 관련**
   - 판매 리스트 (sales_lists)
   - 상품 (products)
   - 판매 승인 보고서 (sales_approval_reports)

3. **구매 관련**
   - 구매 요청 (purchase_requests)
   - 매입 요청 (purchase_orders)
   - 재판매 (resales)

4. **결제 관련**
   - 결제 내역 (payments)

5. **포인트 관련**
   - 포인트 잔액 (points)
   - 포인트 거래 내역 (point_transactions)
   - 포인트 충전 요청 (point_charge_requests)

6. **기타**
   - 재고 분석 (inventory_analyses)

## 초기화 방법

### 방법 1: API 엔드포인트 사용 (권장)

관리자로 로그인한 후 다음 API를 호출합니다:

```bash
POST /api/admin/reset-test-data
```

**요청 예시:**
```javascript
// 브라우저 콘솔 또는 API 클라이언트에서
fetch('/api/admin/reset-test-data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(response => response.json())
.then(data => {
  console.log('초기화 결과:', data);
})
.catch(error => {
  console.error('오류:', error);
});
```

**응답 예시:**
```json
{
  "success": true,
  "message": "테스트 데이터 초기화가 완료되었습니다.",
  "deletionResults": {
    "point_charge_requests": 5,
    "point_transactions": 12,
    "points": 8,
    "sales_approval_reports": 3,
    "resales": 2,
    "payments": 4,
    "purchase_orders": 6,
    "purchase_requests": 10,
    "products": 25,
    "sales_lists": 8,
    "inventory_analyses": 5,
    "profiles": 8
  },
  "totalDeleted": 98,
  "adminCount": 1,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 방법 2: SQL 스크립트 직접 실행

1. Supabase Dashboard에 접속
2. SQL Editor로 이동
3. `scripts/reset-test-data.sql` 파일의 내용을 복사하여 실행

**주의:** SQL 스크립트는 `auth.users` 테이블의 데이터를 직접 삭제하지 않습니다. Supabase Admin API를 사용하거나 Dashboard에서 수동으로 삭제해야 합니다.

### 방법 3: 관리자 대시보드에서 버튼 추가 (선택사항)

관리자 대시보드에 초기화 버튼을 추가할 수 있습니다:

```tsx
// app/(dashboard)/admin/settings/page.tsx에 추가
const handleResetTestData = async () => {
  if (!confirm('정말로 모든 테스트 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
    return
  }

  try {
    const response = await fetch('/api/admin/reset-test-data', {
      method: 'POST',
    })
    const result = await response.json()
    
    if (result.success) {
      alert(`초기화 완료: ${result.totalDeleted}개 항목이 삭제되었습니다.`)
      window.location.reload()
    } else {
      alert(`오류: ${result.error}`)
    }
  } catch (error) {
    alert('초기화 중 오류가 발생했습니다.')
  }
}
```

## 환경 변수 설정

프로덕션 환경에서도 초기화를 허용하려면 (권장하지 않음):

```env
ALLOW_TEST_DATA_RESET=true
```

## Supabase Auth 사용자 삭제

SQL 스크립트는 `auth.users` 테이블을 직접 삭제하지 않습니다. 다음 방법 중 하나를 사용하세요:

### 방법 1: Supabase Dashboard 사용
1. Supabase Dashboard → Authentication → Users
2. 관리자가 아닌 사용자들을 선택하여 삭제

### 방법 2: Supabase Admin API 사용
```javascript
// Node.js 스크립트 예시
const { createClient } = require('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 관리자가 아닌 사용자 ID 조회
const { data: profiles } = await supabaseAdmin
  .from('profiles')
  .select('id')
  .neq('role', 'admin')

const nonAdminIds = profiles.map(p => p.id)

// 각 사용자 삭제
for (const userId of nonAdminIds) {
  await supabaseAdmin.auth.admin.deleteUser(userId)
}
```

## 초기화 확인

초기화 후 다음 쿼리로 확인할 수 있습니다:

```sql
SELECT 
    (SELECT COUNT(*) FROM public.profiles WHERE role != 'admin') as non_admin_profiles,
    (SELECT COUNT(*) FROM public.sales_lists) as sales_lists_count,
    (SELECT COUNT(*) FROM public.products) as products_count,
    (SELECT COUNT(*) FROM public.purchase_requests) as purchase_requests_count,
    (SELECT COUNT(*) FROM public.points WHERE user_id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin')) as non_admin_points,
    (SELECT COUNT(*) FROM public.inventory_analyses) as inventory_analyses_count;
```

모든 값이 0이면 초기화가 성공적으로 완료된 것입니다.

## 문제 해결

### 오류: "관리자 권한이 필요합니다"
- 관리자 계정으로 로그인했는지 확인하세요.
- 프로필의 `role` 필드가 `'admin'`인지 확인하세요.

### 오류: "프로덕션 환경에서는 데이터 초기화가 비활성화되어 있습니다"
- 개발 환경에서 실행하거나
- `ALLOW_TEST_DATA_RESET=true` 환경 변수를 설정하세요 (권장하지 않음)

### 일부 데이터가 삭제되지 않음
- 외래키 제약조건으로 인해 일부 데이터가 남아있을 수 있습니다.
- SQL 스크립트를 직접 실행하여 확인하세요.

## 보안 고려사항

- API 엔드포인트는 관리자 권한을 확인합니다.
- 프로덕션 환경에서는 기본적으로 비활성화되어 있습니다.
- Service Role Key는 서버 사이드에서만 사용되며 클라이언트에 노출되지 않습니다.




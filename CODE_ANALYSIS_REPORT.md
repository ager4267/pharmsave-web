# 코드 분석 보고서 - Supabase 연결 및 기능 모순점 분석

**분석 일시**: 2024년  
**분석 범위**: Supabase 연결, 판매승인보고서 생성 로직, RLS 정책, 데이터 일관성

---

## 📋 목차

1. [Supabase 연결 문제점](#1-supabase-연결-문제점)
2. [판매승인보고서 관련 문제점](#2-판매승인보고서-관련-문제점)
3. [데이터 일관성 문제](#3-데이터-일관성-문제)
4. [RLS 정책과 Service Role 사용](#4-rls-정책과-service-role-사용)
5. [코드 모순점](#5-코드-모순점)
6. [권장 수정 사항](#6-권장-수정-사항)

---

## 1. Supabase 연결 문제점

### 1.1 혼용된 클라이언트 생성 방식

**문제점:**
- 일부 API는 `createRouteHandlerClient` 사용 (인증된 사용자용)
- 대부분의 API는 Service Role 직접 사용 (RLS 우회)
- 두 방식이 혼용되어 일관성 부족

**영향을 받는 파일:**
```typescript
// createRouteHandlerClient 사용
app/api/admin/get-points/route.ts
app/api/buyer/purchase-requests/route.ts
app/api/admin/delete-purchase-request/route.ts
app/api/admin/purchase-requests/route.ts
app/api/seller/purchase-requests/route.ts
app/api/admin/charge-points/route.ts
app/api/user/ledger/route.ts
app/api/admin/ledger/route.ts

// Service Role 직접 사용
app/api/admin/approve-purchase-request/route.ts
app/api/admin/sales-approval-reports/route.ts
// ... 기타 대부분의 API
```

**문제 시나리오:**
1. `createRouteHandlerClient`는 사용자 인증 쿠키를 사용하여 RLS 정책을 따름
2. Service Role은 RLS를 완전히 우회
3. 같은 기능에 대해 다른 접근 방식 사용 시 예상치 못한 동작 가능

### 1.2 createRouteHandlerClient 함수의 불완전한 사용

**문제점:**
- `app/api/seller/purchase-requests/route.ts`에서 `createRouteHandlerClient`로 인증 확인 후, 다시 Service Role 클라이언트 생성
- 이중 클라이언트 생성으로 인한 불필요한 복잡성

```typescript:app/api/seller/purchase-requests/route.ts
// 인증 확인용
const supabase = await createRouteHandlerClient(request, NextResponse.next())
const { data: { user }, error: userError } = await supabase.auth.getUser()

// 실제 작업용 (Service Role)
const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {...})
```

---

## 2. 판매승인보고서 관련 문제점

### 2.1 purchase_order_id NULL 가능성

**문제점:**
- `purchase_orders` 생성이 실패해도 `sales_approval_reports`는 생성됨
- 이 경우 `purchase_order_id`가 NULL로 저장됨
- 외래 키 제약조건은 NULL을 허용하지만, 데이터 무결성 문제 가능

```typescript:app/api/admin/approve-purchase-request/route.ts
// purchase_orders 생성 (실패 가능)
const { data: purchaseOrder, error: orderError } = await supabase
  .from('purchase_orders')
  .insert({...})

if (orderError) {
  console.warn('⚠️ 중개 수수료 정보 저장 실패:', orderError.message)
  // 구매 요청은 승인된 상태로 유지
}

// 판매 승인 보고서 생성 (purchaseOrder가 없어도 생성)
const { data: report, error: reportError } = await supabase
  .from('sales_approval_reports')
  .insert({
    purchase_order_id: purchaseOrder?.id || null, // NULL 가능
    ...
  })
```

**영향:**
- `purchase_order_id`가 NULL인 보고서는 `purchase_orders`와 연결되지 않음
- 중개 수수료 정보 추적 불가능
- 보고서와 주문 간 데이터 불일치

### 2.2 변수 스코프 문제

**문제점:**
- `totalAmount`, `purchasePrice`, `commission` 변수가 `purchase_orders` 생성 블록 내에서 정의됨
- 하지만 `sales_approval_reports` 생성 시에도 사용됨
- `purchase_orders` 생성이 실패하면 변수는 여전히 정의되어 있지만, 데이터 일관성 문제 가능

```typescript:app/api/admin/approve-purchase-request/route.ts
// purchase_orders 생성 블록 내에서 정의
const purchasePrice = totalPrice - commission
const totalAmount = totalPrice

// 하지만 sales_approval_reports 생성 시에도 사용
// purchase_orders 생성이 실패해도 변수는 사용 가능
```

**권장 수정:**
- 변수를 블록 외부로 이동하여 명확한 스코프 유지

### 2.3 seller_id 검증 타이밍

**문제점:**
- `seller_id` 검증이 `purchase_orders` 생성 후, `sales_approval_reports` 생성 전에 수행됨
- `purchase_orders` 생성 시에는 `seller_id` 검증이 없음

```typescript:app/api/admin/approve-purchase-request/route.ts
// seller_id 검증이 purchase_orders 생성 후에 수행됨
if (!product.seller_id) {
  console.error('❌ 상품의 seller_id가 없습니다:', product)
  return NextResponse.json(...)
}
```

**권장 수정:**
- `seller_id` 검증을 `purchase_orders` 생성 전으로 이동

---

## 3. 데이터 일관성 문제

### 3.1 purchase_orders.status 기본값과 실제 사용

**문제점:**
- 스키마에서 `purchase_orders.status`의 기본값은 `'requested'`
- 하지만 코드에서는 관리자 승인 시 바로 `'approved'`로 설정

```sql:supabase/migrations/001_initial_schema.sql
status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'approved', 'rejected', 'delivered', 'completed'))
```

```typescript:app/api/admin/approve-purchase-request/route.ts
status: 'approved', // 관리자가 승인했으므로 바로 approved
```

**영향:**
- 기본값과 실제 사용이 불일치
- `'requested'` 상태가 실제로 사용되지 않을 수 있음
- 상태 전환 로직의 명확성 부족

### 3.2 products.quantity 업데이트 로직

**문제점:**
- 수량이 0 이하가 되면 `status`를 `'sold'`로 변경하고 `quantity`는 1로 유지
- CHECK 제약조건 `quantity > 0` 때문에 1로 유지하는 것은 이해 가능하지만, 실제 재고와 불일치

```typescript:app/api/admin/approve-purchase-request/route.ts
if (newQuantity <= 0) {
  updateData.status = 'sold'
  updateData.quantity = 1  // 실제 재고는 0인데 1로 유지
} else {
  updateData.status = 'active'
  updateData.quantity = newQuantity
}
```

**영향:**
- 재고 수량과 실제 데이터 불일치
- 재고 관리 시스템의 정확성 문제

---

## 4. RLS 정책과 Service Role 사용

### 4.1 RLS 정책 설정과 실제 사용 불일치

**문제점:**
- 모든 테이블에 RLS가 활성화되어 있음
- 하지만 대부분의 API가 Service Role을 사용하여 RLS를 우회
- RLS 정책이 실제로 작동하지 않음

**영향:**
- RLS 정책이 설정되어 있지만 실제로는 사용되지 않음
- 보안 정책과 실제 구현 간 불일치
- RLS 정책 변경 시 실제 동작에 영향 없음

### 4.2 sales_approval_reports RLS 정책

**RLS 정책:**
```sql:supabase/migrations/002_sales_approval_reports.sql
-- 판매자는 자신의 보고서만 조회 가능
CREATE POLICY "판매자는 자신의 판매 승인 보고서 조회 가능"
    ON public.sales_approval_reports
    FOR SELECT
    USING (
        seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
```

**실제 사용:**
```typescript:app/api/admin/sales-approval-reports/route.ts
// Service Role 사용으로 RLS 우회
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {...})
```

**영향:**
- RLS 정책이 설정되어 있지만 Service Role로 우회됨
- 프론트엔드에서 직접 Supabase 클라이언트를 사용할 경우에만 RLS가 작동
- API를 통한 접근은 RLS를 우회하므로 정책이 무의미

---

## 5. 코드 모순점

### 5.1 product 객체 처리 불일치

**문제점:**
- `purchaseRequest.products`가 배열일 수 있는데, 일부 코드에서는 객체로 가정
- 배열 처리 로직이 일관되지 않음

```typescript:app/api/admin/approve-purchase-request/route.ts
// 배열 처리
const product = Array.isArray(purchaseRequest.products) 
  ? purchaseRequest.products[0] 
  : purchaseRequest.products
```

```typescript:app/api/seller/purchase-requests/route.ts
// 배열 처리 (다른 방식)
const processedData = (requests || []).map((req: any) => ({
  ...req,
  product_name: Array.isArray(req.products) 
    ? req.products[0]?.product_name 
    : req.products?.product_name || '-',
}))
```

**영향:**
- 데이터 구조에 대한 가정이 일관되지 않음
- 배열/객체 처리 로직이 분산되어 유지보수 어려움

### 5.2 에러 처리 불일치

**문제점:**
- `purchase_orders` 생성 실패 시 경고만 출력하고 계속 진행
- `sales_approval_reports` 생성 실패 시에도 경고만 출력하고 계속 진행
- 하지만 구매 요청 승인은 성공으로 반환

```typescript:app/api/admin/approve-purchase-request/route.ts
if (orderError) {
  console.warn('⚠️ 중개 수수료 정보 저장 실패:', orderError.message)
  // 구매 요청은 승인된 상태로 유지
}

if (reportError) {
  console.error('❌ 판매 승인 보고서 생성 오류:', reportError)
  // 보고서 생성 실패는 심각한 문제이므로 로그에 명확히 기록
  // 하지만 구매 요청 승인은 유지
}
```

**영향:**
- 부분적 실패가 전체 작업의 성공으로 처리됨
- 사용자에게 실제 상태를 정확히 전달하지 못함
- 디버깅 어려움

---

## 6. 권장 수정 사항

### 6.1 Supabase 클라이언트 사용 통일

**권장:**
1. **인증이 필요한 작업**: `createRouteHandlerClient` 사용
2. **관리자 작업**: Service Role 사용 (명확히 구분)
3. **일관된 패턴**: 같은 기능은 같은 방식 사용

**예시:**
```typescript
// 인증이 필요한 경우
const supabase = createRouteHandlerClient(request, response)
const { data: { user } } = await supabase.auth.getUser()

// 관리자 작업 (Service Role)
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

### 6.2 판매승인보고서 생성 로직 개선

**권장:**
1. `purchase_orders` 생성 실패 시 보고서 생성 중단 또는 명확한 오류 반환
2. `seller_id` 검증을 `purchase_orders` 생성 전으로 이동
3. 변수 스코프 명확화

**예시:**
```typescript
// seller_id 검증을 먼저 수행
if (!product.seller_id) {
  return NextResponse.json(
    { success: false, error: '상품 정보에 판매자 ID가 없습니다.' },
    { status: 400 }
  )
}

// 변수를 블록 외부로 이동
const purchasePrice = totalPrice - commission
const totalAmount = totalPrice

// purchase_orders 생성
const { data: purchaseOrder, error: orderError } = await supabase
  .from('purchase_orders')
  .insert({...})

if (orderError) {
  // purchase_orders 생성 실패 시 보고서도 생성하지 않음
  return NextResponse.json(
    { success: false, error: '구매 주문 생성에 실패했습니다.' },
    { status: 500 }
  )
}

// sales_approval_reports 생성 (purchaseOrder가 반드시 존재)
const { data: report, error: reportError } = await supabase
  .from('sales_approval_reports')
  .insert({
    purchase_order_id: purchaseOrder.id, // NULL이 아님
    ...
  })
```

### 6.3 데이터 일관성 개선

**권장:**
1. `purchase_orders.status` 기본값을 `'approved'`로 변경하거나, 상태 전환 로직 명확화
2. `products.quantity`가 0일 때는 별도 플래그 사용 또는 `quantity`를 0으로 허용하는 제약조건 변경

### 6.4 에러 처리 개선

**권장:**
1. 부분적 실패 시 명확한 오류 메시지 반환
2. 중요 작업 실패 시 전체 작업 롤백 고려
3. 사용자에게 실제 상태를 정확히 전달

**예시:**
```typescript
const errors: string[] = []

if (orderError) {
  errors.push('구매 주문 생성 실패')
}

if (reportError) {
  errors.push('판매 승인 보고서 생성 실패')
}

if (errors.length > 0) {
  return NextResponse.json(
    { 
      success: false, 
      error: '구매 요청 승인 중 일부 작업이 실패했습니다.',
      details: errors
    },
    { status: 500 }
  )
}
```

### 6.5 RLS 정책과 Service Role 사용 명확화

**권장:**
1. RLS 정책이 필요한 경우: Service Role 사용 지양, `createRouteHandlerClient` 사용
2. RLS 정책이 불필요한 경우: Service Role 사용 명확히 문서화
3. 보안 정책 문서화

---

## 7. 우선순위별 수정 권장사항

### 🔴 높은 우선순위 (즉시 수정 권장)

1. **판매승인보고서 생성 로직 개선**
   - `purchase_orders` 생성 실패 시 처리 로직 명확화
   - `seller_id` 검증 타이밍 수정

2. **에러 처리 개선**
   - 부분적 실패 시 명확한 오류 메시지 반환
   - 사용자에게 실제 상태 전달

### 🟡 중간 우선순위 (단기간 내 수정 권장)

3. **Supabase 클라이언트 사용 통일**
   - 일관된 패턴 적용
   - 불필요한 이중 클라이언트 생성 제거

4. **데이터 일관성 개선**
   - `purchase_orders.status` 기본값과 실제 사용 일치
   - `products.quantity` 업데이트 로직 개선

### 🟢 낮은 우선순위 (장기적으로 개선)

5. **RLS 정책과 Service Role 사용 명확화**
   - 보안 정책 문서화
   - RLS 정책 필요 여부 재검토

6. **코드 일관성 개선**
   - `product` 객체 처리 로직 통일
   - 변수 스코프 명확화

---

## 8. 결론

현재 코드베이스는 전반적으로 기능적으로는 작동하지만, 다음과 같은 문제점들이 있습니다:

1. **Supabase 연결 방식의 혼용**: 일관성 부족
2. **판매승인보고서 생성 로직**: 부분적 실패 처리 미흡
3. **데이터 일관성**: 일부 데이터 불일치 가능성
4. **에러 처리**: 사용자에게 정확한 상태 전달 미흡

이러한 문제점들을 단계적으로 수정하여 코드의 안정성과 유지보수성을 향상시킬 수 있습니다.


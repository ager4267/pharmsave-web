'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    company_name: '',
    business_number: '',
    wholesale_license: '',
    phone_number: '',
    address: '',
    account_number: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 사업자등록번호 포맷팅 함수 (숫자만 입력, 자동 하이픈 추가)
  const formatBusinessNumber = (value: string): string => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '')
    
    // 10자리까지만 허용
    const limitedNumbers = numbers.slice(0, 10)
    
    // 하이픈 자동 추가: XXX-XX-XXXXX 형식
    if (limitedNumbers.length <= 3) {
      return limitedNumbers
    } else if (limitedNumbers.length <= 5) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 5)}-${limitedNumbers.slice(5)}`
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // 사업자등록번호인 경우 포맷팅 적용
    if (name === 'business_number') {
      const formatted = formatBusinessNumber(value)
      setFormData((prev) => ({ ...prev, [name]: formatted }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    // 필수 필드 확인 (빈 문자열도 체크)
    if (!formData.email || !formData.password || !formData.company_name || !formData.business_number) {
      setError('필수 항목을 모두 입력해주세요.')
      return
    }
    
    // 전화번호, 주소, 계좌번호 필수 필드 확인
    if (!formData.phone_number || formData.phone_number.trim() === '') {
      setError('전화번호를 입력해주세요.')
      return
    }
    
    if (!formData.address || formData.address.trim() === '') {
      setError('주소를 입력해주세요.')
      return
    }
    
    if (!formData.account_number || formData.account_number.trim() === '') {
      setError('계좌번호를 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      // 1. 회원가입
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('회원가입에 실패했습니다.')
        setLoading(false)
        return
      }

      const userId = authData.user.id
      console.log('✅ 회원가입 성공, 사용자 ID:', userId)

      // 2. 이메일 확인 처리 (필요한 경우)
      // Supabase는 기본적으로 이메일 확인이 필요하므로, 자동으로 확인 처리
      console.log('이메일 확인 처리 시작...')
      try {
        const confirmResponse = await fetch('/api/admin/confirm-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            userId: userId,
            email: formData.email 
          }),
        })
        
        const confirmResult = await confirmResponse.json()
        if (confirmResult.success) {
          console.log('✅ 이메일 확인 처리 완료')
          // 이메일 확인 후 잠시 대기 (auth.users 업데이트 반영 시간)
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          console.warn('⚠️ 이메일 확인 처리 실패:', confirmResult.error)
          // 이메일 확인 실패해도 계속 진행 (이미 확인되었을 수 있음)
          // 하지만 추가 대기 시간 확보
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (confirmError) {
        console.warn('⚠️ 이메일 확인 처리 실패 (계속 진행):', confirmError)
        // 이메일 확인 실패해도 계속 진행
        // 하지만 추가 대기 시간 확보
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // auth.users에 사용자가 완전히 생성될 시간 확보
      console.log('사용자 생성 완료 대기 중...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 3. 세션 확인 및 필요시 로그인 (프로필 조회를 위해 세션 필요)
      let { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      // 세션이 없으면 로그인 시도 (회원가입 직후 세션이 자동으로 설정되지 않을 수 있음)
      if (!session) {
        console.log('세션이 없어서 로그인 시도 중...')
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })
        
        if (signInError) {
          console.error('로그인 오류:', signInError)
          // 이메일 인증이 필요한 경우 세션이 없을 수 있음
          // 이 경우에도 계속 진행 (트리거가 프로필을 생성했을 수 있음)
        } else {
          session = signInData.session
          console.log('로그인 성공, 세션 설정됨')
        }
      } else {
        console.log('세션이 이미 설정되어 있음')
      }

      // 4. 프로필 확인 및 대기 (프로필이 트리거로 생성될 때까지)
      // 프로필이 생성될 때까지 최대 10초 대기 (100회 * 100ms = 10초)
      let profileExists = false
      let lastError: any = null
      let retryCount = 0
      const maxRetries = 100
      
      console.log('프로필 생성 대기 시작...')
      
      for (let i = 0; i < maxRetries; i++) {
        // maybeSingle() 사용: 0개 또는 1개 행 허용 (single()은 0개일 때 오류 발생)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, company_name, business_number')
          .eq('id', userId)
          .maybeSingle()  // single() 대신 maybeSingle() 사용
        
        if (profile) {
          profileExists = true
          console.log(`✅ 프로필 확인됨 (시도 ${i + 1}/${maxRetries}):`, profile)
          break
        }
        
        if (profileError) {
          lastError = profileError
          console.log(`프로필 조회 시도 ${i + 1}/${maxRetries}:`, profileError.message)
          
          // "Cannot coerce" 오류는 프로필이 없을 때 발생할 수 있음 (정상)
          if (profileError.message.includes('Cannot coerce')) {
            console.log('프로필이 아직 생성되지 않음, 대기 중...')
            // 오류를 무시하고 계속 대기
            lastError = null
          }
          
          // RLS 정책 오류인 경우 세션 문제일 수 있음
          if (profileError.message.includes('row-level security') || 
              profileError.message.includes('RLS') ||
              profileError.message.includes('permission denied')) {
            console.log('RLS 정책 오류 감지, 세션 재확인 중...')
            // 세션 재확인
            const { data: { session: newSession } } = await supabase.auth.getSession()
            if (!newSession) {
              console.log('세션이 여전히 없음, 잠시 대기 후 재시도...')
              // 세션 재설정 시도
              if (retryCount < 3) {
                retryCount++
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                  email: formData.email,
                  password: formData.password,
                })
                if (signInData?.session) {
                  console.log('세션 재설정 성공')
                  retryCount = 0
                }
              }
            }
          }
        } else {
          // 에러가 없지만 프로필이 없는 경우 (정상 - 아직 생성되지 않음)
          if (i % 10 === 0) {  // 10회마다 로그 출력
            console.log(`프로필 조회 시도 ${i + 1}/${maxRetries}: 프로필이 아직 생성되지 않음 (대기 중...)`)
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 5. 프로필이 없으면 서버 사이드 API로 프로필 생성 시도
      if (!profileExists) {
        console.log('프로필이 생성되지 않음, 서버 사이드 API로 프로필 생성 시도...')
        
        // 회사명과 사업자등록번호가 필수이므로 확인
        if (!formData.company_name || !formData.business_number) {
          setError('회사명과 사업자등록번호는 필수 항목입니다.')
          setLoading(false)
          return
        }
        
        // 잠시 대기 (auth.users에 사용자가 완전히 생성될 시간 확보)
        // 이메일 확인 처리 후 추가 대기 시간
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        try {
          const response = await fetch('/api/admin/create-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: userId,
              email: formData.email,
              companyName: formData.company_name.trim(), // 공백 제거
              businessNumber: formData.business_number.replace(/-/g, ''), // 하이픈 제거
            }),
          })

          const data = await response.json()

          if (response.ok && data.success) {
            console.log('✅ 서버 사이드에서 프로필 생성 성공:', data)
            profileExists = true
          } else {
            console.error('서버 사이드 프로필 생성 실패:', data.error)
            
            // 외래키 제약조건 오류인 경우 재시도
            if (data.error && (data.error.includes('foreign key constraint') || 
                               data.error.includes('auth.users에 사용자가 존재하지 않습니다'))) {
              console.log('외래키 오류 감지, 1초 후 재시도...')
              await new Promise(resolve => setTimeout(resolve, 1000))
              
              // 재시도
              const retryResponse = await fetch('/api/admin/create-profile', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: userId,
                  email: formData.email,
                  companyName: formData.company_name.trim(),
                  businessNumber: formData.business_number.replace(/-/g, ''),
                }),
              })
              
              const retryData = await retryResponse.json()
              
              if (retryResponse.ok && retryData.success) {
                console.log('✅ 재시도 후 프로필 생성 성공')
                profileExists = true
              } else {
                // 재시도 실패 시, 프로필이 실제로 생성되었는지 확인
                console.log('재시도 실패, 프로필 존재 여부 확인 중...')
                const { data: checkProfile } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('id', userId)
                  .maybeSingle()
                
                if (checkProfile) {
                  console.log('✅ 프로필이 실제로 존재함, 계속 진행')
                  profileExists = true
                } else {
                  setError(
                    `프로필 생성에 실패했습니다: 회원가입은 완료되었지만 프로필 생성에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요. (오류: ${retryData.error || '알 수 없는 오류'})`
                  )
                  setLoading(false)
                  return
                }
              }
            } else {
              // 프로필 생성 실패 시, 프로필이 실제로 생성되었는지 확인
              console.log('프로필 생성 실패, 프로필 존재 여부 확인 중...')
              const { data: checkProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle()
              
              if (checkProfile) {
                console.log('✅ 프로필이 실제로 존재함, 계속 진행')
                profileExists = true
              } else {
                setError(
                  `프로필 생성에 실패했습니다: ${data.error || '알 수 없는 오류'} 관리자에게 문의하세요.`
                )
                setLoading(false)
                return
              }
            }
          }
        } catch (apiError: any) {
          console.error('서버 사이드 API 호출 실패:', apiError)
          setError(
            `프로필 생성에 실패했습니다: ${apiError.message || '알 수 없는 오류'} 관리자에게 문의하세요.`
          )
          setLoading(false)
          return
        }
      }
      
      if (!profileExists) {
        console.error('프로필 생성 최종 실패:', lastError)
        setError(
          '프로필 생성에 실패했습니다. 프로필이 생성되지 않았습니다. 잠시 후 다시 시도해주세요. 관리자에게 문의하세요.'
        )
        return
      }
      
      console.log('✅ 프로필 확인 완료, 프로필 업데이트 시작')

      // 5. 프로필 업데이트 (API를 통해 안전하게 업데이트)
      // 회사명과 사업자등록번호가 필수이므로 확인
      if (!formData.company_name || !formData.business_number) {
        setError('회사명과 사업자등록번호는 필수 항목입니다.')
        return
      }

      try {
        const updateResponse = await fetch('/api/admin/update-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            adminUserId: userId, // 본인 프로필 업데이트
            companyName: formData.company_name.trim(), // 공백 제거
            businessNumber: formData.business_number.replace(/-/g, ''), // 하이픈 제거
            phoneNumber: formData.phone_number.trim(), // 필수 필드이므로 null 체크 불필요
            address: formData.address.trim(), // 필수 필드이므로 null 체크 불필요
            accountNumber: formData.account_number.trim(), // 필수 필드이므로 null 체크 불필요
          }),
        })

        const updateResult = await updateResponse.json()

        if (!updateResponse.ok || !updateResult.success) {
          console.error('프로필 업데이트 오류:', updateResult.error)
          setError(`프로필 업데이트 실패: ${updateResult.error || '알 수 없는 오류'}`)
          return
        }

        console.log('✅ 프로필 업데이트 성공:', updateResult.profile)

        // wholesale_license는 별도로 업데이트 (API에 없음)
        if (formData.wholesale_license) {
          const { error: licenseUpdateError } = await supabase
            .from('profiles')
            .update({
              wholesale_license: formData.wholesale_license,
              license_verification_status: 'pending',
            })
            .eq('id', userId)

          if (licenseUpdateError) {
            console.error('도매업 허가증 업데이트 오류:', licenseUpdateError)
            // 치명적 오류는 아니므로 계속 진행
          }
        }

        console.log('✅ 프로필 업데이트 성공')
      } catch (updateError: any) {
        console.error('프로필 업데이트 API 호출 오류:', updateError)
        setError(`프로필 업데이트 실패: ${updateError.message}`)
        return
      }

      // 6. 관리자에게 이메일 전송 (API Route 호출)
      try {
        await fetch('/api/email/registration-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            email: formData.email,
            company_name: formData.company_name,
            business_number: formData.business_number,
          }),
        })
      } catch (emailError) {
        console.error('이메일 전송 실패:', emailError)
        // 이메일 전송 실패는 치명적이지 않으므로 계속 진행
      }

      // 7. 성공 메시지 및 리다이렉트
      alert('회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.')
      router.push('/login')
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            회원가입
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            팜세이브 (PharmSave) - 도매사 불용재고 중개 플랫폼
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                회사명 <span className="text-red-500">*</span>
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                value={formData.company_name}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="business_number" className="block text-sm font-medium text-gray-700">
                사업자등록번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="business_number"
                name="business_number"
                type="text"
                required
                value={formData.business_number}
                onChange={handleInputChange}
                onKeyPress={(e) => {
                  // 숫자와 하이픈만 허용 (하이픈은 자동 추가되므로 입력 불필요)
                  const char = String.fromCharCode(e.which)
                  if (!/[0-9]/.test(char)) {
                    e.preventDefault()
                  }
                }}
                maxLength={12} // XXX-XX-XXXXX 형식 (하이픈 포함)
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="123-45-67890"
              />
              <p className="mt-1 text-xs text-gray-500">숫자만 입력하세요 (하이픈은 자동으로 추가됩니다)</p>
            </div>

            <div>
              <label htmlFor="wholesale_license" className="block text-sm font-medium text-gray-700">
                도매업 허가증 번호
              </label>
              <input
                id="wholesale_license"
                name="wholesale_license"
                type="text"
                value={formData.wholesale_license}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="선택사항"
              />
            </div>

            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="phone_number"
                name="phone_number"
                type="tel"
                required
                value={formData.phone_number}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="필수 입력"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                주소 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="address"
                name="address"
                rows={3}
                required
                value={formData.address}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="필수 입력"
              />
            </div>

            <div>
              <label htmlFor="account_number" className="block text-sm font-medium text-gray-700">
                계좌번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="account_number"
                name="account_number"
                type="text"
                required
                value={formData.account_number}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="정산용 사업자 계좌번호 (필수 입력)"
              />
              <p className="mt-1 text-xs text-gray-500">판매 정산을 위한 계좌번호입니다</p>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              이미 계정이 있으신가요? 로그인
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}


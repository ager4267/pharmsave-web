import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-50 text-gray-700 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* 왼쪽: 팜세이브몰 브랜드 */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">팜세이브몰</h2>
            <p className="text-xs text-gray-500">
              주식회사 에스피엠메디칼
            </p>
          </div>

          {/* 오른쪽: 링크 및 정보 */}
          <div className="flex flex-col gap-4 text-sm">
            {/* 링크 */}
            <div className="flex flex-wrap gap-4">
              <Link href="/privacy-policy" className="hover:text-gray-900 underline">
                개인정보처리방침
              </Link>
              <Link href="/terms" className="hover:text-gray-900 underline">
                이용약관
              </Link>
              <Link href="/email-policy" className="hover:text-gray-900 underline">
                이메일주소무단수집금지 및 사칭 금지 고지
              </Link>
            </div>

            {/* 사업자 정보 */}
            <div className="text-xs text-gray-500">
              <p>사업자등록번호: [사업자등록번호]</p>
              <p>대표자: [대표자명]</p>
              <p>주소: [주소]</p>
              <p>연락처: 02-3390-4267</p>
              <p>이메일: spm4267@naver.com</p>
            </div>

            {/* 면책 조항 */}
            <div className="text-xs text-gray-400 mt-2">
              <p>본 플랫폼은 거래 중개 서비스를 제공하며, 실제 거래 및 분쟁은 당사자 간에 처리됩니다.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}


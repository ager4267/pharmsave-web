'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SellerNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/seller/dashboard') {
      return pathname === '/seller/dashboard'
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8" aria-label="Tabs">
          <Link
            href="/seller/dashboard"
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              isActive('/seller/dashboard')
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            대시보드
          </Link>
          <Link
            href="/seller/sales-list"
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              isActive('/seller/sales-list') && !isActive('/seller/sales-list/new')
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            판매 리스트
          </Link>
          <Link
            href="/seller/sales-list/new"
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              isActive('/seller/sales-list/new')
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            판매 요청
          </Link>
          <Link
            href="/seller/inventory-analysis"
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              isActive('/seller/inventory-analysis')
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            재고 분석
          </Link>
          <Link
            href="/seller/purchase-requests"
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              isActive('/seller/purchase-requests')
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            구매 요청
          </Link>
          <Link
            href="/seller/sales-approval-reports"
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              isActive('/seller/sales-approval-reports')
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            판매 승인 보고서
          </Link>
          <Link
            href="/seller/points/ledger"
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              isActive('/seller/points/ledger')
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            원장 조회
          </Link>
        </nav>
      </div>
    </div>
  )
}


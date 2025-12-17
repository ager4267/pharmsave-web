import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { QueryProvider } from '@/lib/providers/query-provider'

// 폰트 최적화: display swap으로 폰트 로딩 중에도 텍스트 표시
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: '팜세이브 (PharmSave) - 도매사 불용재고 중개 플랫폼',
    template: '%s | 팜세이브',
  },
  description: 'B2B 의약품 세이브 마켓 - 도매사 불용재고 중개 플랫폼',
  keywords: ['의약품', '도매', '불용재고', 'B2B', '중개플랫폼', 'PharmSave'],
  authors: [{ name: '팜세이브' }],
  creator: '팜세이브',
  publisher: '팜세이브',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    siteName: '팜세이브',
    title: '팜세이브 (PharmSave) - 도매사 불용재고 중개 플랫폼',
    description: 'B2B 의약품 세이브 마켓 - 도매사 불용재고 중개 플랫폼',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={inter.variable}>
      <head>
        {/* DNS Prefetch */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        {/* Preconnect for faster font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>
        <QueryProvider>
          <Navigation />
          <div className="flex flex-col min-h-screen">
            {children}
            <Footer />
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}


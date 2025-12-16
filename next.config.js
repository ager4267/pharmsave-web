/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    // 하위 호환성을 위해 domains도 유지 (deprecated)
    domains: ['localhost'],
  },
  // 프로덕션 환경 최적화
  compress: true,
  poweredByHeader: false,
  // 환경 변수 검증
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
}

module.exports = nextConfig


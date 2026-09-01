import type { NextConfig } from 'next'

// Заголовки безопасности. X-Frame-Options НЕ ставим глобально: страница
// /widget/[venueId] предназначена для встраивания в iframe на сайтах заведений,
// и SAMEORIGIN сломал бы этот сценарий. Защиту от кликджекинга для остального
// сайта лучше добавить точечно (CSP frame-ancestors) отдельным шагом.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  // camera=(self) — разрешаем камеру на своём домене для QR-сканера заезда (правка #20)
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Виджет /widget предназначен для встраивания на сайты заведений — разрешаем любой источник (#35)
      { source: '/widget/:path*', headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }] },
      // Остальные страницы (вход, кабинеты и т.д.) нельзя встраивать в чужой iframe — защита от кликджекинга (#35)
      { source: '/((?!widget).*)', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }] },
    ]
  },
}

export default nextConfig

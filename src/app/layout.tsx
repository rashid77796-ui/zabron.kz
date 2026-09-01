import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/providers'
import { OG_IMAGE } from '@/lib/seo'
import './globals.css'
import 'leaflet/dist/leaflet.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zabron.kz'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Zabron — онлайн-бронирование мест отдыха в Казахстане',
    template: '%s | Zabron',
  },
  description: 'Маркетплейс мгновенного бронирования мест отдыха в Казахстане. Бани, сауны, рестораны, развлечения.',
  applicationName: 'Zabron',
  // Фавиконки (пакет Favicon.im). В App Router их описывают через metadata,
  // а не <link> в разметке: Next сам рендерит теги в <head> и дедуплицирует их.
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/android-chrome-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/android-chrome-512x512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Zabron',
    locale: 'ru_RU',
    url: SITE_URL,
    title: 'Zabron — онлайн-бронирование мест отдыха в Казахстане',
    description: 'Маркетплейс мгновенного бронирования мест отдыха в Казахстане. Бани, сауны, рестораны, развлечения.',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zabron — онлайн-бронирование',
    description: 'Мгновенное бронирование мест отдыха в Казахстане.',
    images: [OG_IMAGE],
  },
  verification: {
    yandex: '9b39116408212c78',
  },
}

export const viewport: Viewport = {
  // Явно фиксируем ширину под устройство, чтобы исключить фактор viewport в
  // проблеме горизонтального переполнения на мобильных (правка #32).
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7101F1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

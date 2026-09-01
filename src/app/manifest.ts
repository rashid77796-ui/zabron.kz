import type { MetadataRoute } from 'next'

// Web App Manifest — делает сайт устанавливаемым как приложение (правка 16).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zabron — онлайн-бронирование',
    short_name: 'Zabron',
    description: 'Бронируйте бани, рестораны и места отдыха в Казахстане за пару минут.',
    start_url: '/',
    display: 'standalone',
    background_color: '#7101F1',
    theme_color: '#7101F1',
    lang: 'ru',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

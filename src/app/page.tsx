import type { Metadata } from 'next'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: {
    absolute: 'Zabron — онлайн-бронирование бань, ресторанов и мест отдыха в Казахстане',
  },
  description:
    'Найдите и забронируйте баню, сауну, ресторан или место отдыха в Казахстане за пару минут. Мгновенное подтверждение, без звонков.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: 'Zabron — онлайн-бронирование мест отдыха в Казахстане',
    description:
      'Найдите и забронируйте баню, сауну, ресторан или место отдыха за пару минут. Мгновенное подтверждение, без звонков.',
    url: '/',
  },
}

export default function Page() {
  return <HomeClient />
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import VenuesClient from './VenuesClient'

export const metadata: Metadata = {
  title: 'Каталог заведений',
  description:
    'Все заведения для онлайн-бронирования в Казахстане: бани, сауны, рестораны и развлечения. Фильтры по категориям, поиск и карта.',
  alternates: { canonical: '/venues' },
}

export default function Page() {
  return (
    <Suspense>
      <VenuesClient />
    </Suspense>
  )
}

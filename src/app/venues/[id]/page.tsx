import type { Metadata } from 'next'
import { Suspense, cache } from 'react'
import { prisma } from '@/server/db/client'
import { isVideo } from '@/lib/media'
import { OG_IMAGE } from '@/lib/seo'
import VenueDetailClient from './VenueDetailClient'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zabron.kz'

// cache() дедуплицирует запрос между generateMetadata и рендером страницы.
const getVenue = cache(async (id: string) => {
  try {
    return await prisma.venue.findUnique({
      where: { id },
      select: {
        name: true,
        description: true,
        address: true,
        photos: true,
        phone: true,
        lat: true,
        lng: true,
        category: { select: { nameRu: true } },
        reviews: { where: { status: 'PUBLISHED' }, select: { rating: true } },
        hours: { select: { dayOfWeek: true, openTime: true, closeTime: true }, orderBy: { dayOfWeek: 'asc' } },
      },
    })
  } catch {
    // БД недоступна (например, во время сборки) — отдаём базовые метаданные
    return null
  }
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const venue = await getVenue(id)

  if (!venue) {
    return { title: 'Заведение' }
  }

  const category = venue.category?.nameRu ?? 'Заведение'
  const title = `${venue.name} — забронировать онлайн`
  const description =
    venue.description?.trim().slice(0, 160) ||
    `${category} «${venue.name}» — ${venue.address}. Онлайн-бронирование на Zabron.`

  // В photos лежат и видео (галерея показывает их вперемешку) — в превью
  // мессенджера ролик отдать нельзя, поэтому берём первый кадр-картинку.
  // Размеры не указываем: они у загруженных фото разные и неизвестны здесь,
  // а соврать краулеру хуже, чем промолчать. Если фото нет — общая заглушка:
  // openGraph из layout сюда не наследуется, Next заменяет блок целиком.
  const photo = venue.photos?.find(p => !isVideo(p))
  const images = photo ? [{ url: photo, alt: venue.name }] : [OG_IMAGE]

  return {
    title,
    description,
    alternates: { canonical: `/venues/${id}` },
    openGraph: {
      type: 'website',
      siteName: 'Zabron',
      locale: 'ru_RU',
      title: `${venue.name} — Zabron`,
      description,
      url: `/venues/${id}`,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${venue.name} — Zabron`,
      description,
      images,
    },
  }
}

type VenueForJsonLd = NonNullable<Awaited<ReturnType<typeof getVenue>>>

// JSON-LD LocalBusiness для расширенных результатов в поиске (правка #38).
function buildJsonLd(id: string, v: VenueForJsonLd) {
  const ratings = v.reviews.map((r) => r.rating)
  const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: v.name,
    description: v.description,
    url: `${BASE_URL}/venues/${id}`,
    ...(v.photos.length ? { image: v.photos } : {}),
    address: { '@type': 'PostalAddress', streetAddress: v.address, addressCountry: 'KZ' },
    ...(v.lat && v.lng ? { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } : {}),
    ...(v.phone ? { telephone: v.phone } : {}),
    ...(avg && ratings.length
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avg.toFixed(1), reviewCount: ratings.length } }
      : {}),
    ...(v.hours.length
      ? {
          openingHoursSpecification: v.hours.map((h) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: dayNames[h.dayOfWeek],
            opens: h.openTime,
            closes: h.closeTime,
          })),
        }
      : {}),
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const venue = await getVenue(id)
  const jsonLd = venue ? buildJsonLd(id, venue) : null

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <Suspense>
        <VenueDetailClient />
      </Suspense>
    </>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api, type ApiVenue } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { VenuePhotoCarousel } from '@/components/VenuePhotoCarousel'
import { FavoriteButton } from '@/components/FavoriteButton'
import { VenueStatusBadge } from '@/components/VenueStatusBadge'
import { HeroSlider } from '@/components/HeroSlider'
import { CategoryGrid } from '@/components/CategoryGrid'
import { Flame, Star, Clock, MapPin, ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { formatPrice } from '@/lib/utils'

function VenueCard({ venue }: { venue: ApiVenue }) {
  const { t } = useI18n()
  // Минимальная цена за час среди всех кабинок — как в каталоге (правка #2).
  const prices = venue.resources.map(r => r.pricePerHour).filter((p): p is number => p != null)
  const minPrice = prices.length ? Math.min(...prices) : null

  return (
    <Link href={`/venues/${venue.id}`}>
      <div className="group h-full overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg">
        <div className="relative h-40 overflow-hidden bg-muted sm:h-44">
          <VenuePhotoCarousel
            photos={venue.photos}
            alt={venue.name}
            fallback={<Flame className="h-12 w-12 text-muted-foreground opacity-20" />}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
            {venue.isFeatured && <Badge className="bg-amber-500">В топе</Badge>}
            <span className="ml-auto"><FavoriteButton venueId={venue.id} /></span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end p-2">
            <VenueStatusBadge hours={venue.hours} />
          </div>
        </div>
        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-sm font-semibold leading-tight">{venue.name}</h3>
            {venue.avgRating != null && (
              <div className="flex shrink-0 items-center gap-1 text-xs text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>{venue.avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({venue.reviewCount})</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{venue.address}</span>
          </div>
          {/* Категория + цена в одной строке — тот же набор данных, что в каталоге */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <Badge variant="secondary" className="text-xs">{venue.category.nameRu}</Badge>
            {minPrice != null && (
              <span className="shrink-0 text-xs text-muted-foreground">
                от {formatPrice(minPrice)} {t.home.perHour}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function VenueCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Skeleton className="h-40 w-full sm:h-44" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  )
}

/**
 * Секция с горизонтальной лентой карточек (по образцу kino.kz):
 * заголовок слева, ссылка «все →» справа, лента со snap-прокруткой.
 */
function CardLane({
  title,
  icon,
  href,
  linkLabel,
  count,
  children,
}: {
  title: string
  icon?: React.ReactNode
  href: string
  linkLabel: string
  /** Сколько всего в разделе — показываем рядом со ссылкой, как «все 47» на афишах. */
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="container mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          {icon}{title}
        </h2>
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm text-primary hover:underline">
          {linkLabel}{count ? ` ${count}` : ''}<ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      {/* Отрицательные поля дают ленте «утекать» под края экрана, как на мобильных афишах.
          scroll-px-4 обязателен в паре с px-4: без него scroll-snap прилипает к
          краю скроллпорта, а не к его паддингу, и после первой же прокрутки лента
          съезжает на 16px влево — карточки перестают попадать в общую сетку. */}
      <div className="scrollbar-none -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-1">
        {children}
      </div>
    </section>
  )
}

/** Обёртка одного элемента ленты: фиксированная ширина + snap. */
function LaneItem({ children }: { children: React.ReactNode }) {
  // 260px вместо 300 — на десктопе в ряд попадает на карточку больше,
  // лента перестаёт выглядеть полупустой при небольшом каталоге.
  return <div className="w-[70%] shrink-0 snap-start sm:w-[260px]">{children}</div>
}

export default function HomePage() {
  const { t } = useI18n()

  const { data: venuesData, isLoading } = useQuery({
    queryKey: ['venues', 'featured'],
    queryFn: () => api.venues.list({ perPage: 12 }),
  })
  const { data: freeToday } = useQuery({
    queryKey: ['venues', 'free-today'],
    queryFn: api.venues.freeToday,
    staleTime: 5 * 60_000,
  })

  return (
    <div>
      {/* Промо-слайдер вверху страницы */}
      <HeroSlider />

      {/* Категории сеткой иконок — мобильная раскладка под слайдером (как kino.kz).
          На десктопе категории живут в липкой ленте CategoryNav под шапкой. */}
      <CategoryGrid />

      {/* Свободно сегодня */}
      {freeToday && freeToday.length > 0 && (
        <CardLane
          title={t.home.freeToday}
          icon={<Clock className="h-5 w-5 text-green-500" />}
          href="/venues"
          linkLabel={t.home.allVenues}
        >
          {freeToday.slice(0, 12).map(v => (
            <LaneItem key={v.id}><VenueCard venue={v} /></LaneItem>
          ))}
        </CardLane>
      )}

      {/* Популярные заведения */}
      <CardLane
        title={t.home.popularVenues}
        href="/venues"
        linkLabel={t.home.allVenues}
        count={venuesData?.total}
      >
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <LaneItem key={i}><VenueCardSkeleton /></LaneItem>
            ))
          : venuesData?.items.map(v => (
              <LaneItem key={v.id}><VenueCard venue={v} /></LaneItem>
            ))}
      </CardLane>

      {!isLoading && venuesData?.items.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <Clock className="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">{t.home.venuesSoon}</p>
          <p className="mt-2 text-sm">{t.home.venuesSoonDesc}</p>
        </div>
      )}
    </div>
  )
}

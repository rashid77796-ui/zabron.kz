'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api, type ApiVenue, type ApiCategory, type ApiFavorite } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { categoryIcon, sortCategories } from '@/lib/categories'
import { formatPrice } from '@/lib/utils'
import type { Bathhouse } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { VenuePhotoCarousel } from '@/components/VenuePhotoCarousel'
import { FavoriteButton } from '@/components/FavoriteButton'
import { VenueStatusBadge } from '@/components/VenueStatusBadge'
import { Search, MapPin, Star, Flame, Heart, ChevronLeft, ChevronRight, LayoutGrid, Map as MapIcon } from 'lucide-react'

const BathhouseMap = dynamic(() => import('@/components/BathhouseMap'), { ssr: false })

const PAGE_SIZE = 18

// Варианты сортировки каталога (правка #3)
type SortKey = 'rating' | 'price_asc' | 'price_desc' | 'popular'
const SORT_OPTIONS: { v: SortKey; l: string }[] = [
  { v: 'rating', l: 'По рейтингу' },
  { v: 'price_asc', l: 'Сначала дешёвые' },
  { v: 'price_desc', l: 'Сначала дорогие' },
  { v: 'popular', l: 'Популярные' },
]

function VenueCard({ venue }: { venue: ApiVenue }) {
  // Минимальная цена за час среди всех кабинок (правка #2), а не цена первой.
  const prices = venue.resources.map(r => r.pricePerHour).filter((p): p is number => p != null)
  const minPrice = prices.length ? Math.min(...prices) : null
  return (
    <Link href={`/venues/${venue.id}`}>
      <div className="group rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
        <div className="relative h-44 bg-muted overflow-hidden shrink-0">
          <VenuePhotoCarousel
            photos={venue.photos}
            alt={venue.name}
            fallback={<Flame className="h-10 w-10 text-muted-foreground/20" />}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
            {venue.isFeatured && (
              <Badge className="bg-amber-500 text-xs">В топе</Badge>
            )}
            <span className="ml-auto"><FavoriteButton venueId={venue.id} /></span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end p-2">
            <VenueStatusBadge hours={venue.hours} />
          </div>
        </div>
        <div className="p-4 space-y-1.5 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight line-clamp-1">{venue.name}</h3>
            {venue.avgRating != null && (
              <div className="flex items-center gap-1 text-xs text-amber-500 shrink-0">
                <Star className="h-3 w-3 fill-current" />
                <span>{venue.avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({venue.reviewCount})</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{venue.address}</span>
          </div>
          <div className="flex items-center justify-between mt-auto pt-2">
            <Badge variant="secondary" className="text-xs">{venue.category.nameRu}</Badge>
            {minPrice != null && (
              <span className="text-xs text-muted-foreground">от {formatPrice(minPrice)} ₸/ч</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function FavoriteVenueCard({ fav }: { fav: ApiFavorite }) {
  const v = fav.venue
  const prices = v.resources.map(r => r.pricePerHour).filter((p): p is number => p != null)
  const minPrice = prices.length ? Math.min(...prices) : null
  const avgRating = v.reviews.length
    ? Math.round((v.reviews.reduce((s, r) => s + r.rating, 0) / v.reviews.length) * 10) / 10
    : null
  return (
    <Link href={`/venues/${v.id}`}>
      <div className="group rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
        <div className="relative h-44 bg-muted overflow-hidden shrink-0">
          <VenuePhotoCarousel photos={v.photos} alt={v.name} fallback={<Flame className="h-10 w-10 text-muted-foreground/20" />} />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end p-2">
            <FavoriteButton venueId={v.id} />
          </div>
        </div>
        <div className="p-4 space-y-1.5 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight line-clamp-1">{v.name}</h3>
            {avgRating != null && (
              <div className="flex items-center gap-1 text-xs text-amber-500 shrink-0">
                <Star className="h-3 w-3 fill-current" /><span>{avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{v.address}</span>
          </div>
          <div className="flex items-center justify-between mt-auto pt-2">
            <Badge variant="secondary" className="text-xs">{v.category.nameRu}</Badge>
            {minPrice != null && (
              <span className="text-xs text-muted-foreground">от {formatPrice(minPrice)} ₸/ч</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

/** Избранное, сгруппированное по категориям — авто-подборки (правка #56). */
function FavoritesGrouped({ favorites }: { favorites: ApiFavorite[] }) {
  const groups = new Map<string, { name: string; items: ApiFavorite[] }>()
  for (const f of favorites) {
    const key = f.venue.category.id
    if (!groups.has(key)) groups.set(key, { name: f.venue.category.nameRu, items: [] })
    groups.get(key)!.items.push(f)
  }
  const ordered = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return (
    <div className="space-y-8">
      {ordered.map(g => (
        <div key={g.name}>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            {g.name}
            <span className="text-sm font-normal text-muted-foreground">{g.items.length}</span>
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map(f => <FavoriteVenueCard key={f.id} fav={f} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function VenueListContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const categoryParam = searchParams.get('category') ?? undefined
  const sortParam = searchParams.get('sort')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') ?? '')
  const [sort, setSort] = useState<SortKey>(
    sortParam === 'price_asc' || sortParam === 'price_desc' || sortParam === 'popular' ? sortParam : 'rating'
  )
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '')
  const [minRating, setMinRating] = useState(Number(searchParams.get('minRating') ?? 0))
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [favOnly, setFavOnly] = useState(searchParams.get('fav') === '1')
  const { user } = useAuth()

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
  })

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: api.favorites.list,
    enabled: !!user,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['venues', categoryParam, debouncedSearch, sort, minPrice, maxPrice, minRating, page],
    queryFn: () => api.venues.list({
      category: categoryParam,
      search: debouncedSearch || undefined,
      sort,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minRating: minRating > 0 ? minRating : undefined,
      page,
      perPage: PAGE_SIZE,
    }),
  })

  const { data: markers, isLoading: markersLoading } = useQuery({
    queryKey: ['venue-markers', categoryParam, debouncedSearch],
    queryFn: () => api.venues.markers({ category: categoryParam, search: debouncedSearch || undefined }),
    enabled: view === 'map',
  })

  // Debounce поиска: один запрос через 400мс после остановки ввода (правка #4)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Синхронизация фильтров и поиска с URL (правки #3/#4): ссылкой можно поделиться,
  // при перезагрузке состояние сохраняется. replace — чтобы не засорять историю.
  useEffect(() => {
    const params = new URLSearchParams()
    if (categoryParam) params.set('category', categoryParam)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (sort !== 'rating') params.set('sort', sort)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    if (minRating > 0) params.set('minRating', String(minRating))
    router.replace(`/venues?${params}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam, debouncedSearch, sort, minPrice, maxPrice, minRating])

  const setCategory = (slug: string | undefined) => {
    const params = new URLSearchParams()
    if (slug) params.set('category', slug)
    if (search) params.set('search', search) // поиск сохраняем при смене категории
    if (sort !== 'rating') params.set('sort', sort)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    if (minRating > 0) params.set('minRating', String(minRating))
    setPage(1)
    router.push(`/venues?${params}`)
  }

  const hasActiveFilters = sort !== 'rating' || !!minPrice || !!maxPrice || minRating > 0
  const resetFilters = () => {
    setSort('rating'); setMinPrice(''); setMaxPrice(''); setMinRating(0); setPage(1)
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или адресу..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filters + view toggle */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={!categoryParam ? 'default' : 'outline'}
            className="px-3 py-1.5 cursor-pointer"
            onClick={() => setCategory(undefined)}
          >
            Все
          </Badge>
          {sortCategories(categories ?? []).map((cat: ApiCategory) => {
            const Icon = categoryIcon(cat.slug)
            return (
              <Badge
                key={cat.slug}
                variant={categoryParam === cat.slug ? 'default' : 'outline'}
                className="gap-1.5 px-3 py-1.5 cursor-pointer"
                onClick={() => setCategory(cat.slug)}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.nameRu}
              </Badge>
            )
          })}
          {user && (
            <Badge
              variant={favOnly ? 'default' : 'outline'}
              className="gap-1.5 px-3 py-1.5 cursor-pointer"
              onClick={() => { setFavOnly(v => !v); setPage(1) }}
            >
              <Heart className={`h-3.5 w-3.5 ${favOnly ? 'fill-current' : ''}`} />
              Избранное
              {(favorites?.length ?? 0) > 0 && <span className="opacity-80">{favorites?.length}</span>}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 rounded-lg border p-0.5">
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5"
            onClick={() => setView('list')}
          >
            <LayoutGrid className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Список</span>
          </Button>
          <Button
            variant={view === 'map' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5"
            onClick={() => setView('map')}
          >
            <MapIcon className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Карта</span>
          </Button>
        </div>
      </div>

      {/* Сортировка и фильтры (правка #3) */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Сортировка</label>
          <select
            value={sort}
            onChange={e => { setSort(e.target.value as SortKey); setPage(1) }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {SORT_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Цена/час, ₸</label>
          <div className="flex items-center gap-1">
            <Input
              type="number" min={0} inputMode="numeric" placeholder="от"
              value={minPrice}
              onChange={e => { setMinPrice(e.target.value); setPage(1) }}
              className="h-9 w-20"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number" min={0} inputMode="numeric" placeholder="до"
              value={maxPrice}
              onChange={e => { setMaxPrice(e.target.value); setPage(1) }}
              className="h-9 w-20"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Мин. рейтинг</label>
          <select
            value={minRating}
            onChange={e => { setMinRating(Number(e.target.value)); setPage(1) }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value={0}>Любой</option>
            <option value={3}>от 3★</option>
            <option value={4}>от 4★</option>
            <option value={4.5}>от 4.5★</option>
          </select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        )}
      </div>

      {/* Map view */}
      {view === 'map' ? (
        markersLoading ? (
          <Skeleton className="h-[500px] w-full rounded-xl" />
        ) : !markers || markers.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Нет заведений на карте</p>
            <p className="text-sm mt-1">Попробуйте другой запрос или категорию</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{markers.length} заведений на карте</p>
            <BathhouseMap
              bathhouses={markers.map(m => ({
                id: m.id,
                ownerId: '',
                name: m.name,
                address: m.address,
                description: '',
                photos: [],
                lat: m.lat,
                lng: m.lng,
              })) as Bathhouse[]}
            />
          </>
        )
      ) : favOnly ? (
        !favorites?.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">В избранном пусто</p>
            <p className="text-sm mt-1">Нажимайте на ♥ в карточках, чтобы сохранять заведения</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{favorites.length} в избранном</p>
            <FavoritesGrouped favorites={favorites} />
          </>
        )
      ) : (
      <>
      {/* Results */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-2xl border overflow-hidden">
              <Skeleton className="h-44 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Ничего не найдено</p>
          <p className="text-sm mt-1">Попробуйте другой запрос или категорию</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {data?.total} заведений
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data?.items.map(v => <VenueCard key={v.id} venue={v} />)}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  )
}

export default function VenuesPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8"><Skeleton className="h-10 w-full mb-4" /></div>}>
      <VenueListContent />
    </Suspense>
  )
}

import { prisma } from '@/server/db/client'
import { ContentStatus, ModerationStatus, Prisma } from '@prisma/client'

// Bayesian average: (C × m + Σr) / (C + n)
// C = global mean rating, m = minimum votes needed to be significant (= 10)
// Protects venues with 1-2 reviews from dominating the ranking
const BAYES_M = 10
function bayesianRating(ratings: number[], globalMean: number): number {
  const n = ratings.length
  if (n === 0) return 0
  const sum = ratings.reduce((s, r) => s + r, 0)
  return (BAYES_M * globalMean + sum) / (BAYES_M + n)
}

export type VenueSort = 'rating' | 'price_asc' | 'price_desc' | 'popular'

export type VenueListParams = {
  categorySlug?: string
  search?: string
  lat?: number
  lng?: number
  radiusKm?: number
  page?: number
  perPage?: number
  publishedOnly?: boolean
  sort?: VenueSort
  minPrice?: number
  maxPrice?: number
  minRating?: number
}

export async function listVenues(params: VenueListParams = {}) {
  const {
    categorySlug, search, page = 1, perPage = 20, publishedOnly = true,
    sort = 'rating', minPrice, maxPrice, minRating,
  } = params

  const where: Prisma.VenueWhereInput = {}

  if (publishedOnly) {
    where.contentStatus = ContentStatus.PUBLISHED
    // Витринные заведения (#20) показываем без требования активного мерчанта.
    where.OR = [
      { merchant: { status: 'ACTIVE' } },
      { listingOnly: true },
    ]
  }

  // Категория матчится по самому заведению ИЛИ по любому его ресурсу (правка #15).
  // Комбинируем с поиском через AND, чтобы OR-условия не перетирали друг друга.
  const and: Prisma.VenueWhereInput[] = []
  if (categorySlug) {
    and.push({ OR: [
      { category: { slug: categorySlug } },
      { resources: { some: { category: { slug: categorySlug } } } },
    ] })
  }
  if (search) {
    and.push({ OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ] })
  }
  // Фильтр цены: заведение проходит, если есть незаблокированная кабинка в диапазоне (правка #3)
  if (minPrice != null || maxPrice != null) {
    const priceCond: Prisma.FloatFilter = {}
    if (minPrice != null) priceCond.gte = minPrice
    if (maxPrice != null) priceCond.lte = maxPrice
    and.push({ resources: { some: { isBlocked: false, pricePerHour: priceCond } } })
  }
  if (and.length) where.AND = and

  // Compute global mean rating across all published venues for Bayesian ranking
  const globalAgg = await prisma.review.aggregate({
    _avg: { rating: true },
    where: { status: 'PUBLISHED', venue: { contentStatus: ContentStatus.PUBLISHED, merchant: { status: 'ACTIVE' } } },
  })
  const globalMean = globalAgg._avg.rating ?? 3.5

  // Фильтры/сортировки по вычисляемым полям (avgRating, minPrice) считаются после
  // маппинга, поэтому выбираем все совпадения и пагинируем в памяти для корректности
  // (правка #3). На запуске каталог небольшой; тяжёлый фильтр доступности — фаза 2.
  const items = await prisma.venue.findMany({
    where,
    include: {
      category: true,
      resources: { where: { isBlocked: false }, select: { id: true, name: true, capacity: true, pricePerHour: true, price: true } },
      reviews: { where: { status: 'PUBLISHED' }, select: { rating: true } },
      merchant: { select: { featuredUntil: true } },
      hours: { select: { id: true, dayOfWeek: true, openTime: true, closeTime: true } }, // для статуса «закроется через N» (правка #54)
    },
  })

  const now = new Date()
  let mapped = items.map(v => {
    const ratings = v.reviews.map(r => r.rating)
    const isFeatured = v.merchant?.featuredUntil ? v.merchant.featuredUntil > now : false
    const prices = v.resources.map(r => r.pricePerHour).filter((p): p is number => p != null)
    return {
      ...v,
      avgRating: ratings.length
        ? ratings.reduce((s, r) => s + r, 0) / ratings.length
        : null,
      bayesRating: bayesianRating(ratings, globalMean),
      reviewCount: ratings.length,
      minPrice: prices.length ? Math.min(...prices) : null,
      isFeatured,
    }
  })

  // Фильтр минимального среднего рейтинга (правка #3)
  if (minRating != null) {
    mapped = mapped.filter(v => (v.avgRating ?? 0) >= minRating)
  }

  // Сортировка: «в топе» (featured) всегда первыми, затем по выбранному критерию (правка #3)
  mapped.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
    switch (sort) {
      case 'price_asc': return (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity)
      case 'price_desc': return (b.minPrice ?? -Infinity) - (a.minPrice ?? -Infinity)
      case 'popular': return b.reviewCount - a.reviewCount
      case 'rating':
      default: return b.bayesRating - a.bayesRating
    }
  })

  const total = mapped.length
  const start = (page - 1) * perPage
  const paged = mapped.slice(start, start + perPage)

  return {
    items: paged,
    total,
    page,
    perPage,
  }
}

// Лёгкий список всех опубликованных заведений для карты (только координаты)
export async function listVenueMarkers(params: { categorySlug?: string; search?: string } = {}) {
  const { categorySlug, search } = params

  const where: Prisma.VenueWhereInput = {
    contentStatus: ContentStatus.PUBLISHED,
    merchant: { status: 'ACTIVE' },
    lat: { not: 0 },
    lng: { not: 0 },
  }

  // Категория — по заведению ИЛИ по любому ресурсу (правка #15).
  const and: Prisma.VenueWhereInput[] = []
  if (categorySlug) {
    and.push({ OR: [
      { category: { slug: categorySlug } },
      { resources: { some: { category: { slug: categorySlug } } } },
    ] })
  }
  if (search) {
    and.push({ OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ] })
  }
  if (and.length) where.AND = and

  return prisma.venue.findMany({
    where,
    select: {
      id: true,
      name: true,
      address: true,
      lat: true,
      lng: true,
      category: { select: { slug: true, nameRu: true } },
    },
  })
}

export async function getVenueById(id: string, publishedOnly = true) {
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: {
      category: true,
      merchant: { select: { status: true, featuredUntil: true } },
      resources: {
        where: { isBlocked: false },
        include: { blackouts: { where: { endAt: { gte: new Date() } } } },
        orderBy: { name: 'asc' },
      },
      hours: { orderBy: { dayOfWeek: 'asc' } },
      reviews: {
        where: { status: 'PUBLISHED' },
        include: { client: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!venue) return null
  if (publishedOnly && venue.contentStatus !== 'PUBLISHED') return null
  // Витринное (#20) показываем и без активного мерчанта.
  if (publishedOnly && !venue.listingOnly && venue.merchant?.status !== 'ACTIVE') return null

  const avgRating = venue.reviews.length
    ? venue.reviews.reduce((s, r) => s + r.rating, 0) / venue.reviews.length
    : null
  const reviewCount = venue.reviews.length
  const isFeatured = venue.merchant?.featuredUntil ? venue.merchant.featuredUntil > new Date() : false

  return { ...venue, avgRating, reviewCount, isFeatured }
}

export async function createVenue(
  merchantId: string,
  data: {
    categoryId: string
    name: string
    description: string
    address: string
    lat: number
    lng: number
    phone?: string
    instagram?: string
    website?: string
    twogis?: string
    tiktok?: string
    listingOnly?: boolean
    photos?: string[]
  }
) {
  return prisma.venue.create({
    // Витринное заведение (#20) публикуется сразу (модерация не нужна), обычное — черновик.
    data: { ...data, merchantId, contentStatus: data.listingOnly ? ContentStatus.PUBLISHED : ContentStatus.DRAFT },
    include: { category: true },
  })
}

type UpdateVenueData = {
  name?: string
  description?: string
  address?: string
  lat?: number
  lng?: number
  phone?: string
  instagram?: string
  website?: string
  twogis?: string
  tiktok?: string
  photos?: string[]
  categoryId?: string
  bookingHorizonDays?: number
  cancellationCutoffHours?: number
  autoRejectMinutesBeforeStart?: number
  minLeadTimeMinutes?: number
  autoRejectNoShowThreshold?: number | null
  autoConfirmUnanswered?: boolean
}

// Создаёт или обновляет активную (PENDING) заявку на модерацию заведения.
async function upsertPendingVenueRequest(
  venueId: string,
  submittedBy: string,
  proposedData: Prisma.InputJsonValue,
) {
  const existing = await prisma.moderationRequest.findFirst({
    where: { entityType: 'venue', entityId: venueId, status: ModerationStatus.PENDING },
  })
  if (existing) {
    await prisma.moderationRequest.update({ where: { id: existing.id }, data: { proposedData } })
  } else {
    await prisma.moderationRequest.create({
      data: { entityType: 'venue', entityId: venueId, proposedData, status: ModerationStatus.PENDING, submittedBy },
    })
    // Уведомляем админов/модераторов о новой заявке (правка #7). Fire-and-forget.
    import('./notification').then(m => m.notifyVenueSubmittedForReview(venueId)).catch(() => {})
  }
}

export async function updateVenue(
  id: string,
  merchantId: string,
  data: UpdateVenueData,
  submittedByUserId?: string
) {
  const venue = await prisma.venue.findUnique({ where: { id } })
  if (!venue || venue.merchantId !== merchantId) throw new Error('NOT_FOUND')

  // Контент (name/description/photos) модерируется; прочие поля применяются сразу.
  // Важно (правка #19): считаем контент изменённым только если значение реально
  // отличается от текущего, иначе сохранение неконтентных полей (телефон и т.п.)
  // порождало бы лишнюю заявку на модерацию.
  const contentData: Record<string, unknown> = {}
  if ('name' in data && data.name !== venue.name) contentData.name = data.name
  if ('description' in data && data.description !== venue.description) contentData.description = data.description
  if ('photos' in data && JSON.stringify(data.photos) !== JSON.stringify(venue.photos)) contentData.photos = data.photos
  const hasContentChange = Object.keys(contentData).length > 0

  const directData: Record<string, unknown> = {}
  if ('address' in data) directData.address = data.address
  if ('lat' in data) directData.lat = data.lat
  if ('lng' in data) directData.lng = data.lng
  if ('phone' in data) directData.phone = data.phone
  if ('instagram' in data) directData.instagram = data.instagram
  if ('website' in data) directData.website = data.website
  if ('twogis' in data) directData.twogis = data.twogis
  if ('tiktok' in data) directData.tiktok = data.tiktok
  if ('categoryId' in data) directData.categoryId = data.categoryId
  if ('bookingHorizonDays' in data) directData.bookingHorizonDays = data.bookingHorizonDays
  if ('cancellationCutoffHours' in data) directData.cancellationCutoffHours = data.cancellationCutoffHours
  if ('autoRejectMinutesBeforeStart' in data) directData.autoRejectMinutesBeforeStart = data.autoRejectMinutesBeforeStart
  if ('minLeadTimeMinutes' in data) directData.minLeadTimeMinutes = data.minLeadTimeMinutes
  if ('autoRejectNoShowThreshold' in data) directData.autoRejectNoShowThreshold = data.autoRejectNoShowThreshold
  if ('autoConfirmUnanswered' in data) directData.autoConfirmUnanswered = data.autoConfirmUnanswered

  const isPublished = venue.contentStatus === ContentStatus.PUBLISHED

  // Опубликованное заведение: контент-правку держим в заявке, живую версию НЕ трогаем —
  // в каталоге остаётся прежняя одобренная версия (правка #9). Прочие поля применяем сразу.
  if (hasContentChange && isPublished && submittedByUserId) {
    const updated = await prisma.venue.update({
      where: { id },
      data: directData as Prisma.VenueUncheckedUpdateInput,
      include: { category: true },
    })
    const proposedData = JSON.parse(JSON.stringify({ ...updated, ...contentData }))
    await upsertPendingVenueRequest(id, submittedByUserId, proposedData)
    return updated
  }

  // Черновик/отклонено/на доработке/первичная модерация — применяем всё сразу
  // и отправляем на модерацию (живой опубликованной версии ещё нет).
  const updated = await prisma.venue.update({
    where: { id },
    data: {
      ...directData,
      ...contentData,
      ...(hasContentChange ? { contentStatus: ContentStatus.PENDING_REVIEW } : {}),
    } as Prisma.VenueUncheckedUpdateInput,
    include: { category: true },
  })
  if (hasContentChange && submittedByUserId) {
    await upsertPendingVenueRequest(id, submittedByUserId, JSON.parse(JSON.stringify(updated)))
  }
  return updated
}

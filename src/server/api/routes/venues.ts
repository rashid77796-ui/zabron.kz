import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireAuth, requireRole } from '@/server/api/middleware/auth'
import { listVenues, listVenueMarkers, getVenueById, createVenue, updateVenue } from '@/server/services/venue'
import { createVenueSchema, updateVenueSchema, venueListQuerySchema } from '@/lib/schemas/venue'
import { prisma } from '@/server/db/client'

type AuthEnv = { Variables: { userId: string; userRole: string } }

const app = new Hono<AuthEnv>()

app.get('/', zValidator('query', venueListQuerySchema), async (c) => {
  const { category, search, page, perPage, sort, minPrice, maxPrice, minRating } = c.req.valid('query')
  const result = await listVenues({ categorySlug: category, search, page, perPage, sort, minPrice, maxPrice, minRating })
  return c.json(result)
})

app.get('/markers', async (c) => {
  const category = c.req.query('category') || undefined
  const search = c.req.query('search') || undefined
  const markers = await listVenueMarkers({ categorySlug: category, search })
  return c.json(markers)
})

// Public: venues with free slots in the next 6 hours ("Свободно сегодня").
// Объявлен ДО '/:id' — иначе одиночный сегмент 'free-today' уходит в него как id
// и роут навсегда отвечает 404.
app.get('/free-today', async (c) => {
  const now = new Date()
  const in6h = new Date(now.getTime() + 6 * 3_600_000)
  const todayDow = now.getDay()

  const venues = await prisma.venue.findMany({
    where: {
      contentStatus: 'PUBLISHED',
      resources: {
        some: {
          isBlocked: false,
          venue: {
            hours: { some: { dayOfWeek: todayDow } },
          },
        },
      },
    },
    take: 20,
    include: {
      category: true,
      merchant: { select: { featuredUntil: true } },
      reviews: { select: { rating: true } },
      resources: {
        where: { isBlocked: false },
        select: {
          id: true, name: true, pricePerHour: true, price: true, capacity: true, defaultDurationMin: true,
          bookings: {
            where: {
              status: { in: ['CONFIRMED', 'PENDING'] },
              startAt: { lt: in6h },
              endAt: { gt: now },
            },
            select: { id: true },
          },
        },
        take: 3,
      },
    },
  })

  return c.json(venues.map(v => ({
    ...v,
    avgRating: v.reviews.length ? v.reviews.reduce((s, r) => s + r.rating, 0) / v.reviews.length : null,
    reviewCount: v.reviews.length,
    isFeatured: v.merchant?.featuredUntil ? v.merchant.featuredUntil > new Date() : false,
    hours: [],
    photos: (v as unknown as { photos: string[] }).photos ?? [],
  })))
})

app.get('/:id', async (c) => {
  const venue = await getVenueById(c.req.param('id'))
  if (!venue) return c.json({ error: 'NOT_FOUND' }, 404)
  return c.json(venue)
})

app.get('/:id/availability', async (c) => {
  const { date } = c.req.query()
  if (!date) return c.json({ error: 'date required' }, 400)

  const venue = await prisma.venue.findUnique({
    where: { id: c.req.param('id') },
    include: { resources: { where: { isBlocked: false } } },
  })
  if (!venue) return c.json({ error: 'NOT_FOUND' }, 404)

  const { getResourceAvailability } = await import('@/server/services/booking')
  const results = await Promise.all(
    venue.resources.map(r => getResourceAvailability(r.id, new Date(date)))
  )
  return c.json(results)
})

// Merchant-only: create venue
app.post(
  '/',
  requireAuth,
  requireRole('merchant', 'super_admin'),
  zValidator('json', createVenueSchema),
  async (c) => {
    const userId = c.get('userId')
    const data = c.req.valid('json')

    let merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
    if (!merchant) {
      merchant = await prisma.merchant.create({ data: { ownerUserId: userId } })
    }

    // Витринное заведение (#20) может создавать только супер-админ.
    const userRole = c.get('userRole')
    const payload = { ...data, listingOnly: userRole === 'super_admin' ? (data as { listingOnly?: boolean }).listingOnly ?? false : false }
    const venue = await createVenue(merchant.id, payload as Parameters<typeof createVenue>[1])
    return c.json(venue, 201)
  }
)

// Merchant-only: update venue
app.patch(
  '/:id',
  requireAuth,
  requireRole('merchant', 'super_admin'),
  zValidator('json', updateVenueSchema),
  async (c) => {
    const userId = c.get('userId')
    const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
    if (!merchant) return c.json({ error: 'NOT_FOUND' }, 404)

    try {
      const body = c.req.valid('json')
      const venue = await updateVenue(c.req.param('id'), merchant.id, {
        name: body.name,
        description: body.description,
        address: body.address,
        lat: body.lat,
        lng: body.lng,
        phone: body.phone,
        instagram: body.instagram,
        website: body.website,
        twogis: body.twogis,
        tiktok: body.tiktok,
        photos: body.photos,
        categoryId: body.categoryId,
      }, userId)
      return c.json(venue)
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'NOT_FOUND') return c.json({ error: 'NOT_FOUND' }, 404)
      throw e
    }
  }
)

// Merchant's own venues
app.get('/my/venues', requireAuth, async (c) => {
  const userId = c.get('userId')
  const merchant = await prisma.merchant.findUnique({
    where: { ownerUserId: userId },
    include: {
      venues: {
        include: { category: true, resources: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  const venues = merchant?.venues ?? []

  // Attach the latest moderation request (status + note) so the merchant sees
  // why a venue was rejected or sent back for revision.
  const requests = venues.length
    ? await prisma.moderationRequest.findMany({
        where: { entityType: 'venue', entityId: { in: venues.map(v => v.id) } },
        orderBy: { createdAt: 'desc' },
        select: { entityId: true, status: true, note: true, reviewedAt: true, proposedData: true },
      })
    : []
  const latestByVenue = new Map<string, (typeof requests)[number]>()
  for (const r of requests) if (!latestByVenue.has(r.entityId)) latestByVenue.set(r.entityId, r)

  const result = venues.map(v => {
    const m = latestByVenue.get(v.id)
    // Пока правка на модерации — мерчанту показываем его предложенную (новую) версию,
    // хотя в каталоге пока висит старая одобренная (правка #9).
    let venueOut: typeof v = v
    let hasPendingEdit = false
    if (m && m.status === 'PENDING' && m.proposedData && typeof m.proposedData === 'object') {
      const p = m.proposedData as { name?: unknown; description?: unknown; photos?: unknown }
      venueOut = {
        ...v,
        ...(typeof p.name === 'string' ? { name: p.name } : {}),
        ...(typeof p.description === 'string' ? { description: p.description } : {}),
        ...(Array.isArray(p.photos) ? { photos: p.photos as string[] } : {}),
      }
      hasPendingEdit = true
    }
    return { ...venueOut, moderation: m ? { status: m.status, note: m.note, reviewedAt: m.reviewedAt } : null, hasPendingEdit }
  })
  return c.json(result)
})

export default app

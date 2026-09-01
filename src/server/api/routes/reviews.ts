import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import { createReview, listVenueReviews, listClientReviews, addMerchantResponse, hideReview } from '@/server/services/review'

const app = new Hono()

app.get('/my', requireAuth, async (c) => {
  const userId = c.get('userId')
  const reviews = await listClientReviews(userId)
  return c.json(reviews)
})

app.get('/', async (c) => {
  const venueId = c.req.query('venueId')
  if (!venueId) return c.json({ error: 'venueId required' }, 400)
  const page = Number(c.req.query('page') ?? 1)
  const result = await listVenueReviews(venueId, { page })
  return c.json(result)
})

app.post('/', requireAuth,
  zValidator('json', z.object({
    venueId: z.string(),
    bookingId: z.string().optional(),
    rating: z.number().int().min(1).max(5),
    text: z.string().max(1000).optional(),
    photos: z.array(z.string()).max(5).default([]),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')
    try {
      const review = await createReview({
        venueId: body.venueId,
        bookingId: body.bookingId,
        clientUserId: userId,
        rating: body.rating,
        text: body.text,
        photos: body.photos,
      })
      return c.json(review, 201)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      const status = msg === 'REVIEW_NOT_ALLOWED' ? 403 : msg === 'ALREADY_REVIEWED' ? 409 : 422
      return c.json({ error: msg }, status)
    }
  }
)

app.patch('/:id/response', requireAuth, requireRole('merchant', 'super_admin'),
  zValidator('json', z.object({ response: z.string().min(1).max(500) })),
  async (c) => {
    const id = c.req.param('id')
    const userId = c.get('userId')
    const { response } = c.req.valid('json')
    try {
      const review = await addMerchantResponse(id, userId, response)
      return c.json(review)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, 403)
    }
  }
)

app.delete('/:id', requireAuth, requireRole('moderator', 'super_admin'), async (c) => {
  const id = c.req.param('id')
  try {
    await hideReview(id)
    return c.json({ ok: true })
  } catch {
    return c.json({ error: 'NOT_FOUND' }, 404)
  }
})

export default app

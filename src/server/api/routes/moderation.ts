import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  submitVenueForReview,
  listModerationRequests,
  listMerchantModerationRequests,
  approveModeration,
  rejectModeration,
  requestVenueRevision,
} from '@/server/services/moderation'
import { ModerationStatus } from '@prisma/client'

const app = new Hono()

app.post('/venues/:venueId/submit', requireAuth, requireRole('merchant', 'super_admin'), async (c) => {
  const venueId = c.req.param('venueId')
  const userId = c.get('userId')
  try {
    const req = await submitVenueForReview(venueId, userId)
    return c.json(req)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'NOT_FOUND' ? 404 : 422
    return c.json({ error: msg }, status)
  }
})

// Merchant: own moderation history (all submissions across their venues)
app.get('/my', requireAuth, requireRole('merchant', 'super_admin'), async (c) => {
  const userId = c.get('userId')
  const items = await listMerchantModerationRequests(userId)
  return c.json({ items })
})

app.get('/', requireAuth, requireRole('moderator', 'super_admin'), async (c) => {
  const page = Number(c.req.query('page') ?? 1)
  const statusParam = c.req.query('status') as ModerationStatus | undefined
  const result = await listModerationRequests({ status: statusParam, page })
  return c.json(result)
})

app.post('/:id/approve', requireAuth, requireRole('moderator', 'super_admin'), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  try {
    const result = await approveModeration(id, userId)
    return c.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    return c.json({ error: msg }, 422)
  }
})

app.post('/:id/reject', requireAuth, requireRole('moderator', 'super_admin'),
  zValidator('json', z.object({ note: z.string().min(1) })),
  async (c) => {
    const id = c.req.param('id')
    const userId = c.get('userId')
    const { note } = c.req.valid('json')
    try {
      const result = await rejectModeration(id, userId, note)
      return c.json(result)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, 422)
    }
  }
)

app.post('/:id/revise', requireAuth, requireRole('moderator', 'super_admin'),
  zValidator('json', z.object({ note: z.string().min(1) })),
  async (c) => {
    const id = c.req.param('id')
    const userId = c.get('userId')
    const { note } = c.req.valid('json')
    try {
      const result = await requestVenueRevision(id, userId, note)
      return c.json(result)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, 422)
    }
  }
)

export default app

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import { createDiscount, listVenueDiscounts, deleteDiscount } from '@/server/services/discount'
import { DiscountType } from '@prisma/client'

const app = new Hono()

app.get('/', async (c) => {
  const venueId = c.req.query('venueId')
  if (!venueId) return c.json({ error: 'venueId required' }, 400)
  const discounts = await listVenueDiscounts(venueId)
  return c.json(discounts)
})

app.post('/', requireAuth, requireRole('merchant', 'super_admin'),
  zValidator('json', z.object({
    venueId: z.string(),
    type: z.nativeEnum(DiscountType),
    percentage: z.number().int().min(1).max(90),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().optional(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')
    try {
      const discount = await createDiscount({
        venueId: body.venueId,
        merchantUserId: userId,
        type: body.type as DiscountType,
        percentage: body.percentage,
        dayOfWeek: body.dayOfWeek,
        startTime: body.startTime,
        endTime: body.endTime,
        validFrom: body.validFrom,
        validTo: body.validTo,
      })
      return c.json(discount, 201)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, 403)
    }
  }
)

app.delete('/:id', requireAuth, requireRole('merchant', 'super_admin'), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  try {
    await deleteDiscount(id, userId)
    return c.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    const status = msg === 'FORBIDDEN' ? 403 : 404
    return c.json({ error: msg }, status)
  }
})

export default app

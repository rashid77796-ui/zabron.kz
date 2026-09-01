import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  createResource, updateResource, deleteResource,
  setVenueHours, getVenueHours,
  listResourceBlackouts, createBlackout, deleteBlackout,
} from '@/server/services/resource'
import { prisma } from '@/server/db/client'
import { AllocationMode } from '@prisma/client'

const app = new Hono()

// ─── Resources ────────────────────────────────────────────────────────────────

app.post('/', requireAuth, requireRole('merchant', 'super_admin'),
  zValidator('json', z.object({
    venueId: z.string(),
    name: z.string().min(1).max(100),
    capacity: z.number().int().min(1),
    quantity: z.number().int().min(1).default(1),
    allocationMode: z.nativeEnum(AllocationMode).default(AllocationMode.SPECIFIC),
    pricePerHour: z.number().int().min(0).optional(),
    price: z.number().int().min(0).optional(),
    bookingDeposit: z.number().int().min(0).nullable().optional(),
    defaultDurationMin: z.number().int().min(30).default(120),
    photos: z.array(z.string()).max(5).default([]),
    categoryId: z.string().nullable().optional(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')
    const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
    if (!merchant) return c.json({ error: 'NO_MERCHANT' }, 403)
    try {
      const resource = await createResource({
        venueId: body.venueId,
        merchantId: merchant.id,
        name: body.name,
        capacity: body.capacity,
        quantity: body.quantity,
        allocationMode: body.allocationMode,
        pricePerHour: body.pricePerHour,
        price: body.price,
        bookingDeposit: body.bookingDeposit,
        defaultDurationMin: body.defaultDurationMin,
        photos: body.photos,
        categoryId: body.categoryId,
      })
      return c.json(resource, 201)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, msg === 'FORBIDDEN' ? 403 : 422)
    }
  }
)

app.patch('/:id', requireAuth, requireRole('merchant', 'super_admin'),
  zValidator('json', z.object({
    name: z.string().min(1).max(100).optional(),
    capacity: z.number().int().min(1).optional(),
    quantity: z.number().int().min(1).optional(),
    pricePerHour: z.number().int().min(0).nullable().optional(),
    price: z.number().int().min(0).nullable().optional(),
    bookingDeposit: z.number().int().min(0).nullable().optional(),
    defaultDurationMin: z.number().int().min(30).optional(),
    photos: z.array(z.string()).max(5).optional(),
    isBlocked: z.boolean().optional(),
    categoryId: z.string().nullable().optional(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')
    const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
    if (!merchant) return c.json({ error: 'NO_MERCHANT' }, 403)
    try {
      const resource = await updateResource({ resourceId: c.req.param('id'), merchantId: merchant.id, ...body })
      return c.json(resource)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, msg === 'FORBIDDEN' ? 403 : 422)
    }
  }
)

app.delete('/:id', requireAuth, requireRole('merchant', 'super_admin'), async (c) => {
  const userId = c.get('userId')
  const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
  if (!merchant) return c.json({ error: 'NO_MERCHANT' }, 403)
  try {
    await deleteResource(c.req.param('id'), merchant.id)
    return c.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'HAS_ACTIVE_BOOKINGS' ? 409 : 404
    return c.json({ error: msg }, status)
  }
})

// ─── Hours ────────────────────────────────────────────────────────────────────

app.get('/hours', async (c) => {
  const venueId = c.req.query('venueId')
  if (!venueId) return c.json({ error: 'venueId required' }, 400)
  return c.json(await getVenueHours(venueId))
})

app.put('/hours', requireAuth, requireRole('merchant', 'super_admin'),
  zValidator('json', z.object({
    venueId: z.string(),
    hours: z.array(z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      openTime: z.string().regex(/^\d{2}:\d{2}$/),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/),
    })),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { venueId, hours } = c.req.valid('json')
    const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
    if (!merchant) return c.json({ error: 'NO_MERCHANT' }, 403)
    try {
      await setVenueHours(venueId, merchant.id, hours as { dayOfWeek: number; openTime: string; closeTime: string }[])
      return c.json({ ok: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, msg === 'FORBIDDEN' ? 403 : 422)
    }
  }
)

// ─── Blackouts ────────────────────────────────────────────────────────────────

app.get('/blackouts', async (c) => {
  const resourceId = c.req.query('resourceId')
  if (!resourceId) return c.json({ error: 'resourceId required' }, 400)
  return c.json(await listResourceBlackouts(resourceId))
})

app.post('/blackouts', requireAuth, requireRole('merchant', 'super_admin'),
  zValidator('json', z.object({
    resourceId: z.string(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reason: z.string().optional(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')
    const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
    if (!merchant) return c.json({ error: 'NO_MERCHANT' }, 403)
    try {
      const blackout = await createBlackout({
        resourceId: body.resourceId,
        merchantId: merchant.id,
        startAt: body.startAt as Date,
        endAt: body.endAt as Date,
        reason: body.reason,
      })
      return c.json(blackout, 201)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, msg === 'FORBIDDEN' ? 403 : 422)
    }
  }
)

app.delete('/blackouts/:id', requireAuth, requireRole('merchant', 'super_admin'), async (c) => {
  const userId = c.get('userId')
  const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
  if (!merchant) return c.json({ error: 'NO_MERCHANT' }, 403)
  try {
    await deleteBlackout(c.req.param('id'), merchant.id)
    return c.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    return c.json({ error: msg }, msg === 'FORBIDDEN' ? 403 : 404)
  }
})

export default app

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  listMerchants, activateMerchant, suspendMerchant, setMerchantFeatured,
  getPlatformMetrics, listUsers, setUserRole, listAuditLogs,
} from '@/server/services/admin'
import { MerchantStatus } from '@prisma/client'

const app = new Hono()

// ─── Platform metrics ──────────────────────────────────────────────────────────

app.get('/metrics', requireAuth, requireRole('super_admin'), async (c) => {
  return c.json(await getPlatformMetrics())
})

// ─── Merchants ─────────────────────────────────────────────────────────────────

app.get('/merchants', requireAuth, requireRole('super_admin'), async (c) => {
  const status = c.req.query('status') as MerchantStatus | undefined
  const page = Number(c.req.query('page') ?? '1')
  const perPage = Number(c.req.query('perPage') ?? '20')
  return c.json(await listMerchants({ status, page, perPage }))
})

app.post('/merchants/:id/activate', requireAuth, requireRole('super_admin'),
  zValidator('json', z.object({
    dealAmount: z.number().int().min(0).optional(),
    dealCurrency: z.string().max(10).optional(),
    dealPlan: z.string().max(100).optional(),
    expiresAt: z.coerce.date().optional(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')
    try {
      const merchant = await activateMerchant(c.req.param('id'), userId, {
        dealAmount: body.dealAmount,
        dealCurrency: body.dealCurrency,
        dealPlan: body.dealPlan,
        expiresAt: body.expiresAt,
      })
      return c.json(merchant)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, msg === 'NOT_FOUND' ? 404 : 422)
    }
  }
)

app.post('/merchants/:id/suspend', requireAuth, requireRole('super_admin'),
  zValidator('json', z.object({ reason: z.string().max(500).optional() })),
  async (c) => {
    const userId = c.get('userId')
    const { reason } = c.req.valid('json')
    try {
      const merchant = await suspendMerchant(c.req.param('id'), userId, reason)
      return c.json(merchant)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, msg === 'NOT_FOUND' ? 404 : 422)
    }
  }
)

app.post('/merchants/:id/feature', requireAuth, requireRole('super_admin'),
  zValidator('json', z.object({ featuredUntil: z.coerce.date().nullable() })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')
    try {
      const merchant = await setMerchantFeatured(c.req.param('id'), userId, body.featuredUntil)
      return c.json(merchant)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, 404)
    }
  }
)

// ─── Users ─────────────────────────────────────────────────────────────────────

app.get('/users', requireAuth, requireRole('super_admin'), async (c) => {
  const page = Number(c.req.query('page') ?? '1')
  const perPage = Number(c.req.query('perPage') ?? '20')
  const search = c.req.query('search')
  const role = c.req.query('role')
  return c.json(await listUsers({ page, perPage, search, role }))
})

app.patch('/users/:id/role', requireAuth, requireRole('super_admin'),
  zValidator('json', z.object({
    role: z.enum(['client', 'merchant', 'moderator', 'super_admin']),
  })),
  async (c) => {
    const actorUserId = c.get('userId')
    const { role } = c.req.valid('json')
    try {
      const user = await setUserRole(c.req.param('id'), role, actorUserId)
      return c.json(user)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, msg === 'NOT_FOUND' ? 404 : 422)
    }
  }
)

// ─── Audit log ─────────────────────────────────────────────────────────────────

app.get('/audit', requireAuth, requireRole('super_admin'), async (c) => {
  const page = Number(c.req.query('page') ?? '1')
  const entityType = c.req.query('entityType')
  return c.json(await listAuditLogs({ page, entityType }))
})

export default app

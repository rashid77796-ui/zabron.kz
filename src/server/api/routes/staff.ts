import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, requireRole } from '@/server/api/middleware/auth'
import { listStaff, addStaff, removeStaff, getMerchantIdForOwner } from '@/server/services/staff'

type AuthEnv = { Variables: { userId: string; userRole: string } }

const app = new Hono<AuthEnv>()
app.use('*', requireAuth)
app.use('*', requireRole('merchant', 'super_admin'))

async function resolveMerchantId(userId: string, role: string, merchantIdQuery?: string): Promise<string | null> {
  if (role === 'super_admin') return merchantIdQuery ?? null
  return getMerchantIdForOwner(userId)
}

app.get('/', async (c) => {
  const userId = c.get('userId')
  const role = c.get('userRole')
  const mid = await resolveMerchantId(userId, role, c.req.query('merchantId'))
  if (!mid) return c.json({ error: role === 'super_admin' ? 'merchantId required' : 'MERCHANT_NOT_FOUND' }, 404)
  const staff = await listStaff(mid)
  return c.json(staff)
})

app.post('/', zValidator('json', z.object({
  email: z.string().email(),
  permissions: z.array(z.string()).default([]),
})), async (c) => {
  const userId = c.get('userId')
  const role = c.get('userRole')
  const mid = await resolveMerchantId(userId, role, c.req.query('merchantId'))
  if (!mid) return c.json({ error: role === 'super_admin' ? 'merchantId required' : 'MERCHANT_NOT_FOUND' }, 404)
  const { email, permissions } = c.req.valid('json')
  try {
    const staff = await addStaff(mid, email, permissions)
    return c.json(staff, 201)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    return c.json({ error: msg }, msg === 'USER_NOT_FOUND' ? 404 : 400)
  }
})

app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const role = c.get('userRole')
  const mid = await resolveMerchantId(userId, role, c.req.query('merchantId'))
  if (!mid) return c.json({ error: role === 'super_admin' ? 'merchantId required' : 'MERCHANT_NOT_FOUND' }, 404)
  const staffId = c.req.param('id')
  try {
    await removeStaff(staffId, mid)
    return c.json({ ok: true })
  } catch {
    return c.json({ error: 'NOT_FOUND' }, 404)
  }
})

export default app

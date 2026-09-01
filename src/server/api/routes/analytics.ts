import { Hono } from 'hono'
import { requireAuth, requireRole } from '../middleware/auth'
import { getMerchantAnalytics, getPlatformAnalytics } from '@/server/services/analytics'

const app = new Hono()

// Аналитика всей платформы — только для админа (правка #25)
app.get('/platform', requireAuth, requireRole('super_admin'), async (c) => {
  const fromStr = c.req.query('from')
  const toStr = c.req.query('to')
  const from = fromStr ? new Date(fromStr) : undefined
  const to = toStr ? new Date(toStr) : undefined
  const data = await getPlatformAnalytics({ from, to })
  return c.json(data)
})

app.get('/merchant', requireAuth, requireRole('merchant', 'super_admin'), async (c) => {
  const userId = c.get('userId')
  const venueId = c.req.query('venueId')
  const fromStr = c.req.query('from')
  const toStr = c.req.query('to')
  const from = fromStr ? new Date(fromStr) : undefined
  const to = toStr ? new Date(toStr) : undefined

  try {
    const data = await getMerchantAnalytics(userId, { from, to, venueId })
    return c.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    return c.json({ error: msg }, 404)
  }
})

export default app

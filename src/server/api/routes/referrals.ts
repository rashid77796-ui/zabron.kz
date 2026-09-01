import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '@/server/api/middleware/auth'
import { getOrCreateReferral, applyReferral, getReferralStats } from '@/server/services/referral'

type AuthEnv = { Variables: { userId: string; userRole: string } }

const app = new Hono<AuthEnv>()
app.use('*', requireAuth)

app.get('/my', async (c) => {
  const userId = c.get('userId')
  const stats = await getReferralStats(userId)
  if (!stats.code) {
    const referral = await getOrCreateReferral(userId)
    return c.json({ code: referral.code, referredCount: 0, rewardGranted: false })
  }
  return c.json(stats)
})

app.post('/apply', zValidator('json', z.object({ code: z.string().min(1) })), async (c) => {
  const userId = c.get('userId')
  const { code } = c.req.valid('json')
  try {
    const result = await applyReferral(code, userId)
    return c.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    const status = msg === 'REFERRAL_NOT_FOUND' ? 404 : 400
    return c.json({ error: msg }, status)
  }
})

export default app

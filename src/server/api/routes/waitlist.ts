import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { joinWaitlist, leaveWaitlist, listClientWaitlist } from '@/server/services/waitlist'

const app = new Hono()

app.get('/', requireAuth, async (c) => {
  const userId = c.get('userId')
  return c.json(await listClientWaitlist(userId))
})

app.post('/', requireAuth,
  zValidator('json', z.object({
    resourceId: z.string(),
    desiredStart: z.coerce.date(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { resourceId, desiredStart } = c.req.valid('json')
    try {
      const entry = await joinWaitlist({ resourceId, clientUserId: userId, desiredStart })
      return c.json(entry, 201)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERROR'
      return c.json({ error: msg }, 409)
    }
  }
)

app.delete('/:id', requireAuth, async (c) => {
  const userId = c.get('userId')
  try {
    await leaveWaitlist(c.req.param('id'), userId)
    return c.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    return c.json({ error: msg }, 403)
  }
})

export default app

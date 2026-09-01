import { Hono } from 'hono'
import { requireAuth } from '@/server/api/middleware/auth'
import { saveFcmToken } from '@/server/services/push'

type AuthEnv = { Variables: { userId: string; userRole: string } }

const app = new Hono<AuthEnv>()
app.use('*', requireAuth)

// Сохранить FCM-токен устройства
app.post('/subscribe', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null) as { token?: string } | null
  if (!body?.token) return c.json({ error: 'INVALID_TOKEN' }, 400)

  await saveFcmToken(userId, body.token)
  return c.json({ ok: true })
})

export default app

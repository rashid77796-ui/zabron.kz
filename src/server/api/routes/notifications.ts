import { Hono } from 'hono'
import { requireAuth } from '@/server/api/middleware/auth'
import { prisma } from '@/server/db/client'

type AuthEnv = { Variables: { userId: string; userRole: string } }

const app = new Hono<AuthEnv>()
app.use('*', requireAuth)

app.get('/', async (c) => {
  const userId = c.get('userId')
  // Показываем доставленные + недоставленные (в приложении видны в любом случае),
  // скрываем только будущие отложенные (правки #41/#31)
  const items = await prisma.notification.findMany({
    where: { userId, OR: [{ sentAt: { not: null } }, { deliveryStatus: 'FAILED' }] },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return c.json(items)
})

// Число непрочитанных — серверный счётчик (правка #31)
app.get('/unread-count', async (c) => {
  const userId = c.get('userId')
  const count = await prisma.notification.count({
    where: { userId, readAt: null, OR: [{ sentAt: { not: null } }, { deliveryStatus: 'FAILED' }] },
  })
  return c.json({ count })
})

// Отметить все уведомления прочитанными на сервере (синхронно между устройствами) — правка #31
app.post('/read', async (c) => {
  const userId = c.get('userId')
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return c.json({ ok: true })
})

export default app

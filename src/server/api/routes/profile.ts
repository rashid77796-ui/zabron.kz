import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '@/server/api/middleware/auth'
import { prisma } from '@/server/db/client'
import { writeAuditLog } from '@/server/services/admin'
import { auth } from '@/server/auth/auth'

type AuthEnv = { Variables: { userId: string; userRole: string } }

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)

const PROFILE_SELECT = {
  id: true, name: true, email: true, phone: true, role: true,
  locale: true, noShowCount: true, image: true, isPhoneVerified: true,
} as const

app.get('/', async (c) => {
  const user = await prisma.user.findUnique({ where: { id: c.get('userId') }, select: PROFILE_SELECT })
  if (!user) return c.json({ error: 'NOT_FOUND' }, 404)
  return c.json(user)
})

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/).optional(),
})

app.patch('/', zValidator('json', updateProfileSchema), async (c) => {
  const userId = c.get('userId')
  const data = c.req.valid('json')

  // Auto-verify phone when it is first provided
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, isPhoneVerified: true } })
  const isPhoneVerified = data.phone && data.phone.trim() && !current?.isPhoneVerified ? true : undefined

  const user = await prisma.user.update({
    where: { id: userId },
    data: { ...data, ...(isPhoneVerified !== undefined ? { isPhoneVerified } : {}) },
    select: PROFILE_SELECT,
  })
  return c.json(user)
})

app.get('/export', async (c) => {
  const userId = c.get('userId')
  const [user, bookings, favorites, reviews, waitlist, referrals, notifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, locale: true, createdAt: true },
    }),
    prisma.booking.findMany({
      where: { clientUserId: userId },
      select: { id: true, startAt: true, endAt: true, guests: true, status: true, comment: true, createdAt: true,
        resource: { select: { name: true, venue: { select: { name: true, address: true } } } } },
    }),
    prisma.favorite.findMany({
      where: { clientUserId: userId },
      select: { venueId: true, venue: { select: { name: true } } },
    }),
    prisma.review.findMany({
      where: { clientUserId: userId },
      select: { id: true, rating: true, text: true, createdAt: true, venue: { select: { name: true } } },
    }),
    prisma.waitlistEntry.findMany({
      where: { clientUserId: userId },
      select: { id: true, desiredStart: true, status: true, createdAt: true,
        resource: { select: { name: true, venue: { select: { name: true } } } } },
    }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      select: { code: true, refereeUserId: true, rewardGranted: true, createdAt: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: { type: true, channel: true, payload: true, sentAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const payload = { exportedAt: new Date().toISOString(), user, bookings, favorites, reviews, waitlist, referrals, notifications }
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="zabron-data-${userId}.json"`,
    },
  })
})

app.delete('/', async (c) => {
  const userId = c.get('userId')
  await writeAuditLog(userId, 'user.selfDelete', 'User', userId)

  // Delete in dependency order; Session/Account/Verification cascade via Prisma onDelete:Cascade
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.waitlistEntry.deleteMany({ where: { clientUserId: userId } }),
    prisma.favorite.deleteMany({ where: { clientUserId: userId } }),
    prisma.review.updateMany({ where: { clientUserId: userId }, data: { status: 'HIDDEN' } }),
    prisma.booking.updateMany({ where: { clientUserId: userId, status: { in: ['PENDING', 'CONFIRMED'] } }, data: { status: 'CANCELLED' } }),
    prisma.referral.deleteMany({ where: { referrerId: userId } }),
    prisma.telegramLink.deleteMany({ where: { userId } }),
    prisma.merchantStaff.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ])

  // Invalidate the session cookie by signing out via Better Auth
  const req = c.req.raw
  await auth.api.signOut({ headers: req.headers })

  return c.json({ ok: true })
})

export default app

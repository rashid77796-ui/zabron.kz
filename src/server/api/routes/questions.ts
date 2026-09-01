import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '@/server/api/middleware/auth'
import { prisma } from '@/server/db/client'

type AuthEnv = { Variables: { userId: string; userRole: string } }

const app = new Hono<AuthEnv>()
app.use('*', requireAuth)

const questionSchema = z.object({
  text: z.string().min(1).max(200),
  fieldType: z.enum(['text', 'select']).default('text'),
  options: z.array(z.string().min(1)).max(10).default([]),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

async function assertOwner(venueId: string, userId: string) {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { merchant: true },
  })
  if (!venue) throw new Error('NOT_FOUND')
  const staff = await prisma.merchantStaff.findFirst({ where: { userId, merchantId: venue.merchantId } })
  if (venue.merchant.ownerUserId !== userId && !staff) throw new Error('FORBIDDEN')
  return venue
}

// GET /venues/:venueId/questions — public, used in booking form
app.get('/venues/:venueId/questions', async (c) => {
  const questions = await prisma.venueQuestion.findMany({
    where: { venueId: c.req.param('venueId') },
    orderBy: { sortOrder: 'asc' },
  })
  return c.json(questions)
})

// POST /venues/:venueId/questions — merchant creates a question (max 3 per venue)
app.post('/venues/:venueId/questions', zValidator('json', questionSchema), async (c) => {
  const userId = c.get('userId')
  const venueId = c.req.param('venueId')
  try {
    await assertOwner(venueId, userId)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'NOT_FOUND') return c.json({ error: 'NOT_FOUND' }, 404)
    if (msg === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN' }, 403)
    throw e
  }

  const count = await prisma.venueQuestion.count({ where: { venueId } })
  if (count >= 3) return c.json({ error: 'MAX_QUESTIONS' }, 422)

  const data = c.req.valid('json')
  const q = await prisma.venueQuestion.create({
    data: {
      venueId,
      text: data.text,
      fieldType: data.fieldType,
      options: data.options,
      isRequired: data.isRequired,
      sortOrder: data.sortOrder,
    },
  })
  return c.json(q, 201)
})

// PATCH /venues/:venueId/questions/:id — merchant edits a question
app.patch('/venues/:venueId/questions/:id', zValidator('json', questionSchema.partial()), async (c) => {
  const userId = c.get('userId')
  const venueId = c.req.param('venueId')
  try {
    await assertOwner(venueId, userId)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'NOT_FOUND') return c.json({ error: 'NOT_FOUND' }, 404)
    if (msg === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN' }, 403)
    throw e
  }

  const data = c.req.valid('json')
  const result = await prisma.venueQuestion.updateMany({
    where: { id: c.req.param('id'), venueId },
    data,
  })
  if (result.count === 0) return c.json({ error: 'NOT_FOUND' }, 404)

  const q = await prisma.venueQuestion.findUnique({ where: { id: c.req.param('id') } })
  return c.json(q)
})

// DELETE /venues/:venueId/questions/:id — merchant deletes a question
app.delete('/venues/:venueId/questions/:id', async (c) => {
  const userId = c.get('userId')
  const venueId = c.req.param('venueId')
  try {
    await assertOwner(venueId, userId)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'NOT_FOUND') return c.json({ error: 'NOT_FOUND' }, 404)
    if (msg === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN' }, 403)
    throw e
  }

  await prisma.venueQuestion.deleteMany({ where: { id: c.req.param('id'), venueId } })
  return c.json({ ok: true })
})

export default app

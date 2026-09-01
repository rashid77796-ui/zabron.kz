import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '@/server/api/middleware/auth'
import { rateLimit } from '@/server/api/middleware/rateLimit'
import { prisma } from '@/server/db/client'
import {
  createBooking,
  confirmBooking,
  rejectBooking,
  cancelBooking,
  markNoShow,
  completeBooking,
  rescheduleBooking,
  getSuggestedSlots,
  listClientBookings,
  listMerchantBookings,
  BookingLimitError,
  SlotConflictError,
  BookingNotFoundError,
  TooLateToBookError,
  TooManyNoShowsError,
} from '@/server/services/booking'
import { createBookingSchema, bookingActionSchema, rescheduleBookingSchema, walkInBookingSchema, guestBookingSchema } from '@/lib/schemas/booking'
import { BookingStatus } from '@prisma/client'

type AuthEnv = { Variables: { userId: string; userRole: string } }

const app = new Hono<AuthEnv>()

// Guest booking — no auth required (20 per hour per IP)
app.post('/guest', rateLimit({ windowMs: 60 * 60_000, max: 20, keyFn: c => c.req.header('x-forwarded-for') ?? 'unknown' }), zValidator('json', guestBookingSchema), async (c) => {
  const body = c.req.valid('json')
  try {
    const booking = await createBooking({
      resourceId: body.resourceId,
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      guests: body.guests,
      comment: body.comment,
      customAnswers: body.customAnswers as Record<string, unknown> | undefined,
      source: 'ONLINE' as import('@prisma/client').BookingSource,
    })
    return c.json(booking, 201)
  } catch (e) {
    if (e instanceof SlotConflictError) return c.json({ error: 'SLOT_CONFLICT' }, 409)
    if (e instanceof TooLateToBookError) return c.json({ error: 'TOO_LATE_TO_BOOK' }, 422)
    if (e instanceof TooManyNoShowsError) return c.json({ error: 'TOO_MANY_NO_SHOWS' }, 422)
    throw e
  }
})

app.use('*', requireAuth)

// Client: create booking (10 per minute per user)
app.post('/', rateLimit({ windowMs: 60_000, max: 10, keyFn: c => c.get('userId') ?? 'anon' }), zValidator('json', createBookingSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  try {
    const booking = await createBooking({
      resourceId: body.resourceId,
      clientUserId: userId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      guests: body.guests,
      comment: body.comment,
      customAnswers: body.customAnswers as Record<string, unknown> | undefined,
      phone: body.phone,
    })
    return c.json(booking, 201)
  } catch (e) {
    if (e instanceof BookingLimitError) return c.json({ error: 'BOOKING_LIMIT' }, 422)
    if (e instanceof TooLateToBookError) return c.json({ error: 'TOO_LATE_TO_BOOK' }, 422)
    if (e instanceof TooManyNoShowsError) return c.json({ error: 'TOO_MANY_NO_SHOWS' }, 422)
    throw e
  }
})

// Client: my bookings
app.get('/my', async (c) => {
  const userId = c.get('userId')
  const { status } = c.req.query()
  const bookings = await listClientBookings(userId, status as BookingStatus | undefined)
  return c.json(bookings)
})

// Merchant: incoming bookings
app.get('/merchant', async (c) => {
  const userId = c.get('userId')
  const { status, venueId, date } = c.req.query()
  const bookings = await listMerchantBookings(userId, {
    status: status as BookingStatus | undefined,
    venueId,
    date: date ? new Date(date) : undefined,
  })
  return c.json(bookings)
})

// Action on a booking (confirm/reject/cancel/no_show/complete)
app.post('/:id/action', zValidator('json', bookingActionSchema), async (c) => {
  const userId = c.get('userId')
  const { action } = c.req.valid('json')
  const bookingId = c.req.param('id')

  try {
    let result
    if (action === 'confirm') result = await confirmBooking(bookingId, userId)
    else if (action === 'reject') result = await rejectBooking(bookingId, userId)
    else if (action === 'cancel') result = await cancelBooking(bookingId, userId)
    else if (action === 'no_show') result = await markNoShow(bookingId, userId)
    else result = await completeBooking(bookingId, userId)

    return c.json(result)
  } catch (e) {
    if (e instanceof BookingNotFoundError) return c.json({ error: 'NOT_FOUND' }, 404)
    if (e instanceof SlotConflictError) return c.json({ error: 'SLOT_CONFLICT' }, 409)
    if (e instanceof Error && e.message === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN' }, 403)
    if (e instanceof Error && e.message === 'INVALID_STATUS') return c.json({ error: 'INVALID_STATUS' }, 422)
    throw e
  }
})

// Suggest free slots near a requested time
app.get('/suggest', zValidator('query', z.object({
  resourceId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
})), async (c) => {
  const { resourceId, startAt, endAt } = c.req.valid('query')
  const durationMs = new Date(endAt).getTime() - new Date(startAt).getTime()
  const suggestions = await getSuggestedSlots({ resourceId, desiredStart: new Date(startAt), durationMs })
  return c.json(suggestions)
})

// Reschedule booking — cancel existing, create new PENDING with new time
app.post('/:id/reschedule', zValidator('json', rescheduleBookingSchema), async (c) => {
  const userId = c.get('userId')
  const { startAt, endAt } = c.req.valid('json')
  try {
    const booking = await rescheduleBooking(c.req.param('id'), userId, new Date(startAt), new Date(endAt))
    return c.json(booking, 201)
  } catch (e) {
    if (e instanceof BookingNotFoundError) return c.json({ error: 'NOT_FOUND' }, 404)
    if (e instanceof BookingLimitError) return c.json({ error: 'BOOKING_LIMIT' }, 422)
    if (e instanceof Error && e.message === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN' }, 403)
    if (e instanceof Error && e.message === 'INVALID_STATUS') return c.json({ error: 'INVALID_STATUS' }, 422)
    throw e
  }
})

// Walk-in / manual booking created by merchant on behalf of an offline guest
app.post('/walkin', zValidator('json', walkInBookingSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  // Verify the caller owns (or staffs) the venue that owns the resource
  const resource = await prisma.resource.findUnique({
    where: { id: body.resourceId },
    include: { venue: { include: { merchant: true } } },
  })
  if (!resource) return c.json({ error: 'NOT_FOUND' }, 404)

  const merchant = resource.venue.merchant
  const staffRecord = await prisma.merchantStaff.findFirst({
    where: { userId, merchantId: merchant.id },
  })
  if (merchant.ownerUserId !== userId && !staffRecord) {
    return c.json({ error: 'FORBIDDEN' }, 403)
  }

  try {
    const booking = await createBooking({
      resourceId: body.resourceId,
      clientUserId: merchant.ownerUserId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      guests: body.guests,
      comment: [
        `[Walk-in] ${body.guestName}`,
        body.guestPhone ? `тел: ${body.guestPhone}` : '',
        body.comment ?? '',
      ].filter(Boolean).join(' | '),
      source: 'MANUAL' as import('@prisma/client').BookingSource,
    })
    // Auto-confirm walk-in bookings immediately
    const confirmed = await confirmBooking(booking.id, userId)
    return c.json(confirmed, 201)
  } catch (e) {
    if (e instanceof SlotConflictError) return c.json({ error: 'SLOT_CONFLICT' }, 409)
    if (e instanceof BookingLimitError) return c.json({ error: 'BOOKING_LIMIT' }, 422)
    throw e
  }
})

// QR check-in scan — merchant scans client's QR and marks CONFIRMED → COMPLETED
app.post('/checkin', zValidator('json', z.object({ code: z.string() })), async (c) => {
  const userId = c.get('userId')
  const { code } = c.req.valid('json')

  const booking = await prisma.booking.findUnique({
    where: { checkInCode: code },
    include: { resource: { include: { venue: { select: { merchantId: true } } } } },
  })

  if (!booking) return c.json({ error: 'NOT_FOUND' }, 404)

  const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
  if (!merchant || booking.resource.venue.merchantId !== merchant.id) {
    return c.json({ error: 'FORBIDDEN' }, 403)
  }

  if (booking.status !== BookingStatus.CONFIRMED) {
    return c.json({ error: 'INVALID_STATUS', currentStatus: booking.status }, 422)
  }

  const updated = await completeBooking(booking.id, userId)
  return c.json(updated)
})

export default app

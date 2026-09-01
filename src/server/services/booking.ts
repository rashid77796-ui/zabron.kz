import { prisma } from '@/server/db/client'
import { BookingStatus, BookingSource, AllocationMode, Prisma } from '@prisma/client'
import crypto from 'crypto'
import {
  notifyBookingCreated,
  notifyBookingConfirmed,
  notifyBookingRejected,
} from './notification'
import { writeAuditLog } from './admin'

export class SlotConflictError extends Error {
  constructor() { super('SLOT_CONFLICT') }
}
export class BookingLimitError extends Error {
  constructor() { super('BOOKING_LIMIT') }
}
export class BookingNotFoundError extends Error {
  constructor() { super('BOOKING_NOT_FOUND') }
}
// Автоприём заявок (правка #53)
export class TooLateToBookError extends Error {
  constructor() { super('TOO_LATE_TO_BOOK') }
}
export class TooManyNoShowsError extends Error {
  constructor() { super('TOO_MANY_NO_SHOWS') }
}

const PENDING_LIMIT = 3
const AUTO_REJECT_HOURS = 24

// Дедлайн авто-снятия неподтверждённой заявки: за N минут до начала (настройка заведения, правка #53),
// но не позже чем через AUTO_REJECT_HOURS от текущего момента.
function computeAutoRejectAt(startAt: Date, minutesBeforeStart = 30): Date {
  const deadline = new Date(startAt.getTime() - minutesBeforeStart * 60 * 1000)
  const limit = new Date(Date.now() + AUTO_REJECT_HOURS * 60 * 60 * 1000)
  return deadline < limit ? deadline : limit
}

export async function createBooking(params: {
  resourceId: string
  clientUserId?: string
  guestName?: string
  guestPhone?: string
  startAt: Date
  endAt: Date
  guests: number
  comment?: string
  customAnswers?: Record<string, unknown>
  source?: BookingSource
  phone?: string
}) {
  const { resourceId, clientUserId, guestName, guestPhone, startAt, endAt, guests, comment, customAnswers, source = BookingSource.ONLINE, phone } = params

  // Ресурс + заведение (нужны настройки автоприёма заявок, правка #53)
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { venue: true },
  })
  if (!resource) throw new BookingNotFoundError()
  const venue = resource.venue
  // Walk-in / ручная бронь владельца (source=MANUAL) не блокируем правилами автоприёма (правка #53)
  const isWalkIn = source === BookingSource.MANUAL

  // Минимальный запас времени до начала (правка #53)
  if (!isWalkIn && venue.minLeadTimeMinutes > 0) {
    const minutesUntilStart = (startAt.getTime() - Date.now()) / 60_000
    if (minutesUntilStart < venue.minLeadTimeMinutes) throw new TooLateToBookError()
  }

  // Лимит активных заявок + порог неявок — только для зарегистрированных
  if (clientUserId) {
    const pendingCount = await prisma.booking.count({
      where: { clientUserId, status: BookingStatus.PENDING },
    })
    if (pendingCount >= PENDING_LIMIT) throw new BookingLimitError()

    if (!isWalkIn && venue.autoRejectNoShowThreshold != null) {
      const u = await prisma.user.findUnique({ where: { id: clientUserId }, select: { noShowCount: true } })
      if (u && u.noShowCount >= venue.autoRejectNoShowThreshold) throw new TooManyNoShowsError()
    }
  }

  // For POOL resources: fail-fast if all units are already confirmed
  if (resource.allocationMode === AllocationMode.POOL && resource.quantity > 1) {
    const confirmedInSlot = await prisma.booking.count({
      where: {
        resourceId,
        status: BookingStatus.CONFIRMED,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    })
    if (confirmedInSlot >= resource.quantity) throw new SlotConflictError()
  }

  const checkInCode = crypto.randomBytes(4).toString('hex').toUpperCase()

  const booking = await prisma.booking.create({
    data: {
      resourceId,
      clientUserId: clientUserId ?? null,
      guestName: guestName ?? null,
      guestPhone: guestPhone ?? null,
      startAt,
      endAt,
      guests,
      comment,
      customAnswers: customAnswers ? (customAnswers as Prisma.InputJsonValue) : Prisma.JsonNull,
      status: BookingStatus.PENDING,
      source,
      checkInCode,
      autoRejectAt: computeAutoRejectAt(startAt, venue.autoRejectMinutesBeforeStart),
    },
    include: {
      resource: { include: { venue: { include: { category: true } } } },
      client: { select: { id: true, name: true, email: true, phone: true } },
    },
  })

  // Save phone to profile on first booking if not already set
  if (phone && clientUserId) {
    prisma.user.updateMany({
      where: { id: clientUserId, phone: null },
      data: { phone },
    }).catch(e => console.error('[profile] phone save:', e))
  }

  // Fire-and-forget: send notification to merchant
  notifyBookingCreated(booking.id).catch(e => console.error('[notify] createBooking:', e))

  return booking
}

export async function confirmBooking(bookingId: string, merchantUserId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { resource: { include: { venue: { include: { merchant: true } } } } },
    })

    if (!booking) throw new BookingNotFoundError()
    if (booking.resource.venue.merchant.ownerUserId !== merchantUserId) {
      throw new Error('FORBIDDEN')
    }
    if (booking.status !== BookingStatus.PENDING) throw new Error('INVALID_STATUS')

    const isPool = booking.resource.allocationMode === AllocationMode.POOL && booking.resource.quantity > 1
    const capacity = isPool ? booking.resource.quantity : 1

    // Count confirmed overlaps (excluding this booking)
    const confirmedOverlapCount = await tx.booking.count({
      where: {
        resourceId: booking.resourceId,
        status: BookingStatus.CONFIRMED,
        id: { not: bookingId },
        startAt: { lt: booking.endAt },
        endAt: { gt: booking.startAt },
      },
    })
    if (confirmedOverlapCount >= capacity) throw new SlotConflictError()

    // Confirm this booking
    const confirmed = await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
    })

    // For POOL: only evict pending bookings when the pool is now fully booked
    // For SPECIFIC: always evict any overlapping pending bookings
    const poolNowFull = confirmedOverlapCount + 1 >= capacity
    let slotTaken: { id: string }[] = []
    if (!isPool || poolNowFull) {
      slotTaken = await tx.booking.findMany({
        where: {
          resourceId: booking.resourceId,
          status: BookingStatus.PENDING,
          id: { not: bookingId },
          startAt: { lt: booking.endAt },
          endAt: { gt: booking.startAt },
        },
        select: { id: true },
      })
      if (slotTaken.length > 0) {
        await tx.booking.updateMany({
          where: { id: { in: slotTaken.map(b => b.id) } },
          data: { status: BookingStatus.SLOT_TAKEN },
        })
      }
    }

    // Fire notifications + audit log after transaction
    setImmediate(() => {
      notifyBookingConfirmed(bookingId).catch(e => console.error('[notify] confirm:', e))
      slotTaken.forEach(b =>
        notifyBookingRejected(b.id, 'SLOT_TAKEN').catch(e => console.error('[notify] slot_taken:', e))
      )
      writeAuditLog(merchantUserId, 'booking.confirm', 'Booking', bookingId, {
        slotTakenCount: slotTaken.length,
      }).catch(e => console.error('[audit] confirm:', e))
    })

    return confirmed
  })
}

export async function rejectBooking(bookingId: string, merchantUserId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { resource: { include: { venue: { include: { merchant: true } } } } },
  })
  if (!booking) throw new BookingNotFoundError()
  if (booking.resource.venue.merchant.ownerUserId !== merchantUserId) throw new Error('FORBIDDEN')
  if (booking.status !== BookingStatus.PENDING) throw new Error('INVALID_STATUS')

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.REJECTED },
  })
  notifyBookingRejected(bookingId, 'REJECTED').catch(e => console.error('[notify] reject:', e))
  writeAuditLog(merchantUserId, 'booking.reject', 'Booking', bookingId).catch(e => console.error('[audit] reject:', e))
  return updated
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { resource: { include: { venue: { include: { merchant: true } } } } },
  })
  if (!booking) throw new BookingNotFoundError()

  const isMerchant = booking.resource.venue.merchant.ownerUserId === userId
  const isClient = booking.clientUserId === userId
  if (!isMerchant && !isClient) throw new Error('FORBIDDEN')

  if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
    throw new Error('INVALID_STATUS')
  }

  // Политика заведения: клиент не может отменить позже, чем за N часов до сеанса (правка #14).
  // На владельца ограничение не распространяется.
  const cancelCutoff = booking.resource.venue.cancellationCutoffHours ?? 0
  if (isClient && !isMerchant && cancelCutoff > 0) {
    const hoursLeft = (booking.startAt.getTime() - Date.now()) / 3_600_000
    if (hoursLeft < cancelCutoff) throw new Error('CANCEL_TOO_LATE')
  }

  const wasConfirmed = booking.status === BookingStatus.CONFIRMED

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
  })

  // Notify waitlist when a CONFIRMED slot frees up
  if (wasConfirmed) {
    import('@/server/services/waitlist')
      .then(m => m.notifyWaitlistOnSlotFreed(booking.resourceId, booking.startAt))
      .catch(e => console.error('[waitlist] notify error:', e))
  }

  return updated
}

export async function markNoShow(bookingId: string, merchantUserId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { resource: { include: { venue: { include: { merchant: true } } } } },
    })
    if (!booking) throw new BookingNotFoundError()
    if (booking.resource.venue.merchant.ownerUserId !== merchantUserId) throw new Error('FORBIDDEN')
    if (booking.status !== BookingStatus.CONFIRMED) throw new Error('INVALID_STATUS')

    const updateOps: Promise<unknown>[] = [
      tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.NO_SHOW } }),
    ]
    if (booking.clientUserId) {
      updateOps.push(tx.user.update({ where: { id: booking.clientUserId }, data: { noShowCount: { increment: 1 } } }))
    }
    const [updated] = await Promise.all(updateOps)
    writeAuditLog(merchantUserId, 'booking.noShow', 'Booking', bookingId, {
      clientUserId: booking.clientUserId,
    }).catch(e => console.error('[audit] noShow:', e))
    return updated
  })
}

export async function rescheduleBooking(bookingId: string, userId: string, newStartAt: Date, newEndAt: Date) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { resource: { include: { venue: { include: { merchant: true } } } } },
  })
  if (!booking) throw new BookingNotFoundError()

  const isMerchant = booking.resource.venue.merchant.ownerUserId === userId
  const isClient = booking.clientUserId === userId
  if (!isMerchant && !isClient) throw new Error('FORBIDDEN')
  if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
    throw new Error('INVALID_STATUS')
  }

  // Политика заведения: перенос позже cutoff запрещён клиенту (правка #14)
  const reschedCutoff = booking.resource.venue.cancellationCutoffHours ?? 0
  if (isClient && !isMerchant && reschedCutoff > 0) {
    const hoursLeft = (booking.startAt.getTime() - Date.now()) / 3_600_000
    if (hoursLeft < reschedCutoff) throw new Error('RESCHEDULE_TOO_LATE')
  }

  // Cancel old booking then create new one in a transaction
  return prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
    })

    const pendingCount = await tx.booking.count({
      where: { clientUserId: booking.clientUserId, status: BookingStatus.PENDING },
    })
    if (pendingCount >= PENDING_LIMIT) throw new BookingLimitError()

    const checkInCode = crypto.randomBytes(4).toString('hex').toUpperCase()
    const newBooking = await tx.booking.create({
      data: {
        resourceId: booking.resourceId,
        clientUserId: booking.clientUserId,
        startAt: newStartAt,
        endAt: newEndAt,
        guests: booking.guests,
        comment: booking.comment,
        customAnswers: booking.customAnswers ?? undefined,
        status: BookingStatus.PENDING,
        source: booking.source,
        checkInCode,
        autoRejectAt: computeAutoRejectAt(newStartAt, booking.resource.venue.autoRejectMinutesBeforeStart),
      },
      include: {
        resource: { include: { venue: { include: { category: true } } } },
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    setImmediate(() => {
      notifyBookingCreated(newBooking.id).catch(e => console.error('[notify] reschedule:', e))
    })

    return newBooking
  })
}

export async function completeBooking(bookingId: string, merchantUserId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { resource: { include: { venue: { include: { merchant: true } } } } },
  })
  if (!booking) throw new BookingNotFoundError()
  if (booking.resource.venue.merchant.ownerUserId !== merchantUserId) throw new Error('FORBIDDEN')
  if (booking.status !== BookingStatus.CONFIRMED) throw new Error('INVALID_STATUS')

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.COMPLETED },
  })
}

export async function listClientBookings(clientUserId: string, status?: BookingStatus) {
  return prisma.booking.findMany({
    where: { clientUserId, ...(status ? { status } : {}) },
    include: {
      resource: { include: { venue: { include: { category: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listMerchantBookings(merchantUserId: string, params: {
  status?: BookingStatus
  venueId?: string
  date?: Date
} = {}) {
  const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: merchantUserId } })
  if (!merchant) return []

  const where: Prisma.BookingWhereInput = {
    resource: { venue: { merchantId: merchant.id, ...(params.venueId ? { id: params.venueId } : {}) } },
  }
  if (params.status) where.status = params.status
  if (params.date) {
    const start = new Date(params.date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    where.startAt = { gte: start, lt: end }
  }

  return prisma.booking.findMany({
    where,
    include: {
      resource: { include: { venue: true } },
      client: { select: { id: true, name: true, email: true, phone: true, noShowCount: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/** Called by the scheduler job — auto-reject expired PENDING bookings. Returns IDs of affected bookings. */
export async function processAutoRejections(): Promise<{ rejected: string[]; confirmed: string[] }> {
  const expired = await prisma.booking.findMany({
    where: { status: BookingStatus.PENDING, autoRejectAt: { lte: new Date() } },
    select: { id: true, resource: { select: { venue: { select: { autoConfirmUnanswered: true } } } } },
  })
  if (expired.length === 0) return { rejected: [], confirmed: [] }

  // Заведения с автоподтверждением — неотвеченные заявки подтверждаем, остальные отклоняем (правка #53)
  const confirmed = expired.filter(b => b.resource.venue.autoConfirmUnanswered).map(b => b.id)
  const rejected = expired.filter(b => !b.resource.venue.autoConfirmUnanswered).map(b => b.id)

  if (confirmed.length > 0) {
    await prisma.booking.updateMany({ where: { id: { in: confirmed } }, data: { status: BookingStatus.CONFIRMED } })
  }
  if (rejected.length > 0) {
    await prisma.booking.updateMany({ where: { id: { in: rejected } }, data: { status: BookingStatus.AUTO_REJECTED } })
  }
  return { rejected, confirmed }
}

/** Returns up to `limit` free slots nearest to the requested start time on the same day. */
export async function getSuggestedSlots(params: {
  resourceId: string
  desiredStart: Date
  durationMs: number
  limit?: number
}): Promise<Array<{ startAt: Date; endAt: Date }>> {
  const { resourceId, desiredStart, durationMs, limit = 3 } = params
  const dayStart = new Date(desiredStart)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { venue: { include: { hours: true } } },
  })
  if (!resource) return []

  const confirmedBookings = await prisma.booking.findMany({
    where: {
      resourceId,
      status: BookingStatus.CONFIRMED,
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { startAt: true, endAt: true },
  })

  const blackouts = await prisma.blackout.findMany({
    where: {
      resourceId,
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { startAt: true, endAt: true },
  })

  const blocked = [...confirmedBookings, ...blackouts]
  const suggestions: Array<{ startAt: Date; endAt: Date }> = []
  const slotMs = durationMs

  // Probe every 30 minutes across the day
  for (let offsetMs = 0; offsetMs < 24 * 3600 * 1000; offsetMs += 30 * 60 * 1000) {
    const start = new Date(dayStart.getTime() + offsetMs)
    const end = new Date(start.getTime() + slotMs)
    if (end > dayEnd) break

    const conflict = blocked.some(b => b.startAt < end && b.endAt > start)
    if (!conflict) {
      suggestions.push({ startAt: start, endAt: end })
      if (suggestions.length >= limit) break
    }
  }

  // Sort by proximity to desired start
  suggestions.sort((a, b) =>
    Math.abs(a.startAt.getTime() - desiredStart.getTime()) -
    Math.abs(b.startAt.getTime() - desiredStart.getTime())
  )

  return suggestions.slice(0, limit)
}

export async function getResourceAvailability(resourceId: string, date: Date, daysAhead?: number) {
  // Горизонт берём из заведения ресурса, если не передан явно (правка #6)
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { venue: { include: { hours: true } } },
  })
  const horizon = daysAhead ?? resource?.venue.bookingHorizonDays ?? 14

  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + horizon)

  const [confirmedBookings, blackouts] = await Promise.all([
    prisma.booking.findMany({
      where: {
        resourceId,
        status: BookingStatus.CONFIRMED,
        startAt: { lt: end },
        endAt: { gt: start },
      },
    }),
    prisma.blackout.findMany({
      where: {
        resourceId,
        startAt: { lt: end },
        endAt: { gt: start },
      },
    }),
  ])

  return { resource, confirmedBookings, blackouts }
}

import { prisma } from '@/server/db/client'
import { AllocationMode, BookingStatus } from '@prisma/client'

// ─── Resources ────────────────────────────────────────────────────────────────

export async function createResource(params: {
  venueId: string
  merchantId: string
  name: string
  capacity: number
  quantity?: number
  allocationMode?: AllocationMode
  pricePerHour?: number
  price?: number
  bookingDeposit?: number | null
  defaultDurationMin?: number
  photos?: string[]
  categoryId?: string | null
}) {
  const { venueId, merchantId, ...data } = params
  const venue = await prisma.venue.findUnique({ where: { id: venueId } })
  if (!venue || venue.merchantId !== merchantId) throw new Error('FORBIDDEN')
  return prisma.resource.create({ data: { venueId, ...data } })
}

export async function updateResource(params: {
  resourceId: string
  merchantId: string
  name?: string
  capacity?: number
  quantity?: number
  pricePerHour?: number | null
  price?: number | null
  bookingDeposit?: number | null
  defaultDurationMin?: number
  photos?: string[]
  isBlocked?: boolean
  categoryId?: string | null
}) {
  const { resourceId, merchantId, ...data } = params
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { venue: true },
  })
  if (!resource || resource.venue.merchantId !== merchantId) throw new Error('FORBIDDEN')
  return prisma.resource.update({ where: { id: resourceId }, data })
}

export async function deleteResource(resourceId: string, merchantId: string) {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { venue: true },
  })
  if (!resource || resource.venue.merchantId !== merchantId) throw new Error('FORBIDDEN')

  const activeCount = await prisma.booking.count({
    where: { resourceId, startAt: { gte: new Date() }, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
  })
  if (activeCount > 0) throw new Error('HAS_ACTIVE_BOOKINGS')

  return prisma.resource.delete({ where: { id: resourceId } })
}

// ─── VenueHours ───────────────────────────────────────────────────────────────

export async function setVenueHours(
  venueId: string,
  merchantId: string,
  hours: { dayOfWeek: number; openTime: string; closeTime: string }[]
) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } })
  if (!venue || venue.merchantId !== merchantId) throw new Error('FORBIDDEN')

  return prisma.$transaction([
    prisma.venueHours.deleteMany({ where: { venueId } }),
    prisma.venueHours.createMany({ data: hours.map(h => ({ ...h, venueId })) }),
  ])
}

export async function getVenueHours(venueId: string) {
  return prisma.venueHours.findMany({ where: { venueId }, orderBy: { dayOfWeek: 'asc' } })
}

// ─── Blackouts ────────────────────────────────────────────────────────────────

export async function listResourceBlackouts(resourceId: string) {
  return prisma.blackout.findMany({
    where: { resourceId, endAt: { gte: new Date() } },
    orderBy: { startAt: 'asc' },
  })
}

export async function createBlackout(params: {
  resourceId: string
  merchantId: string
  startAt: Date
  endAt: Date
  reason?: string
}) {
  const { resourceId, merchantId, ...data } = params
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { venue: true },
  })
  if (!resource || resource.venue.merchantId !== merchantId) throw new Error('FORBIDDEN')
  return prisma.blackout.create({ data: { resourceId, ...data } })
}

export async function deleteBlackout(blackoutId: string, merchantId: string) {
  const blackout = await prisma.blackout.findUnique({
    where: { id: blackoutId },
    include: { resource: { include: { venue: true } } },
  })
  if (!blackout || blackout.resource.venue.merchantId !== merchantId) throw new Error('FORBIDDEN')
  return prisma.blackout.delete({ where: { id: blackoutId } })
}

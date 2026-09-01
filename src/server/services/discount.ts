import { prisma } from '@/server/db/client'
import { DiscountType } from '@prisma/client'

export async function createDiscount(params: {
  venueId: string
  merchantUserId: string
  type: DiscountType
  percentage: number
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  validFrom?: Date
  validTo?: Date
}) {
  const { venueId, merchantUserId, ...data } = params

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, merchant: { ownerUserId: merchantUserId } },
  })
  if (!venue) throw new Error('FORBIDDEN')

  return prisma.discount.create({ data: { venueId, ...data } })
}

export async function listVenueDiscounts(venueId: string) {
  return prisma.discount.findMany({ where: { venueId }, orderBy: { id: 'asc' } })
}

export async function deleteDiscount(discountId: string, merchantUserId: string) {
  const discount = await prisma.discount.findUnique({
    where: { id: discountId },
    include: { venue: { include: { merchant: true } } },
  })
  if (!discount) throw new Error('NOT_FOUND')
  if (discount.venue.merchant.ownerUserId !== merchantUserId) throw new Error('FORBIDDEN')

  return prisma.discount.delete({ where: { id: discountId } })
}

/** Returns the active discount percentage for the given datetime (or now). */
export function getActiveDiscount(
  discounts: {
    type: DiscountType
    percentage: number
    dayOfWeek?: number | null
    startTime?: string | null
    endTime?: string | null
    validFrom?: Date | null
    validTo?: Date | null
  }[],
  at: Date = new Date()
): number {
  const day = at.getDay()
  const timeStr = at.toTimeString().slice(0, 5)

  for (const d of discounts) {
    if (d.type === DiscountType.OFF_PEAK) {
      if (d.dayOfWeek !== null && d.dayOfWeek !== undefined && d.dayOfWeek !== day) continue
      if (d.startTime && d.endTime) {
        if (timeStr >= d.startTime && timeStr < d.endTime) return d.percentage
      } else {
        return d.percentage
      }
    } else if (d.type === DiscountType.TIME_LIMITED) {
      if (d.validFrom && d.validTo && at >= d.validFrom && at <= d.validTo) return d.percentage
    } else if (d.type === DiscountType.FIRST_VISIT) {
      return d.percentage
    }
  }
  return 0
}

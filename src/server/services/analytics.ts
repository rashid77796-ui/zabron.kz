import { prisma } from '@/server/db/client'
import { BookingStatus } from '@prisma/client'

// Аналитика всей платформы для админа (правка #25): агрегирует по всем заведениям.
export async function getPlatformAnalytics(params: { from?: Date; to?: Date } = {}) {
  const now = new Date()
  const from = params.from ?? new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const to = params.to ?? now

  const bookings = await prisma.booking.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      resource: {
        select: {
          pricePerHour: true,
          price: true,
          venue: { select: { id: true, name: true } },
        },
      },
    },
  })

  const byStatus = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const confirmed = byStatus[BookingStatus.CONFIRMED] ?? 0
  const completed = byStatus[BookingStatus.COMPLETED] ?? 0
  const noShows = byStatus[BookingStatus.NO_SHOW] ?? 0
  const rejected = (byStatus[BookingStatus.REJECTED] ?? 0) + (byStatus[BookingStatus.AUTO_REJECTED] ?? 0)
  const cancelled = byStatus[BookingStatus.CANCELLED] ?? 0

  const bookingValue = (b: (typeof bookings)[number]) => {
    if (b.status !== BookingStatus.CONFIRMED && b.status !== BookingStatus.COMPLETED) return 0
    const hours = (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000
    if (b.resource.pricePerHour) return b.resource.pricePerHour * hours
    if (b.resource.price) return b.resource.price
    return 0
  }

  let revenue = 0
  for (const b of bookings) revenue += bookingValue(b)

  const denomConv = confirmed + completed + rejected + cancelled
  const conversionRate = denomConv > 0 ? Math.round(((confirmed + completed) / denomConv) * 100) : 0
  const denomNoShow = completed + noShows
  const noShowRate = denomNoShow > 0 ? Math.round((noShows / denomNoShow) * 100) : 0

  // Динамика броней и выручки по дням
  const byDayMap: Record<string, { count: number; revenue: number }> = {}
  for (const b of bookings) {
    const day = b.createdAt.toISOString().slice(0, 10)
    if (!byDayMap[day]) byDayMap[day] = { count: 0, revenue: 0 }
    byDayMap[day].count += 1
    byDayMap[day].revenue += bookingValue(b)
  }
  const byDay = Object.entries(byDayMap)
    .map(([date, v]) => ({ date, count: v.count, revenue: Math.round(v.revenue) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Топ заведений по бронам и выручке
  const venueMap: Record<string, { id: string; name: string; count: number; revenue: number }> = {}
  for (const b of bookings) {
    const v = b.resource.venue
    if (!v) continue
    if (!venueMap[v.id]) venueMap[v.id] = { id: v.id, name: v.name, count: 0, revenue: 0 }
    venueMap[v.id].count += 1
    venueMap[v.id].revenue += bookingValue(b)
  }
  const venues = Object.values(venueMap).map(v => ({ ...v, revenue: Math.round(v.revenue) }))
  const topByBookings = [...venues].sort((a, b) => b.count - a.count).slice(0, 10)
  const topByRevenue = [...venues].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Совокупные показатели платформы
  const [totalUsers, totalMerchants, totalVenues] = await Promise.all([
    prisma.user.count(),
    prisma.merchant.count(),
    prisma.venue.count(),
  ])

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    total: bookings.length,
    confirmed,
    completed,
    noShows,
    rejected,
    cancelled,
    byStatus,
    revenue: Math.round(revenue),
    conversionRate,
    noShowRate,
    byDay,
    topByBookings,
    topByRevenue,
    totals: { users: totalUsers, merchants: totalMerchants, venues: totalVenues },
  }
}

export async function getMerchantAnalytics(merchantUserId: string, params: {
  from?: Date
  to?: Date
  venueId?: string
} = {}) {
  const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: merchantUserId } })
  if (!merchant) throw new Error('NOT_FOUND')

  const now = new Date()
  const from = params.from ?? new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = params.to ?? now

  const bookings = await prisma.booking.findMany({
    where: {
      resource: {
        venue: {
          merchantId: merchant.id,
          ...(params.venueId ? { id: params.venueId } : {}),
        },
      },
      createdAt: { gte: from, lte: to },
    },
    include: { resource: { select: { pricePerHour: true, price: true } } },
  })

  const byStatus = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const confirmed = byStatus[BookingStatus.CONFIRMED] ?? 0
  const completed = byStatus[BookingStatus.COMPLETED] ?? 0
  const noShows = byStatus[BookingStatus.NO_SHOW] ?? 0
  const rejected = (byStatus[BookingStatus.REJECTED] ?? 0) + (byStatus[BookingStatus.AUTO_REJECTED] ?? 0)
  const cancelled = byStatus[BookingStatus.CANCELLED] ?? 0

  let revenue = 0
  for (const b of bookings) {
    if (b.status !== BookingStatus.CONFIRMED && b.status !== BookingStatus.COMPLETED) continue
    const hours = (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000
    if (b.resource.pricePerHour) revenue += b.resource.pricePerHour * hours
    else if (b.resource.price) revenue += b.resource.price
  }

  const denomConv = confirmed + completed + rejected + cancelled
  const conversionRate = denomConv > 0 ? Math.round(((confirmed + completed) / denomConv) * 100) : 0

  const denomNoShow = completed + noShows
  const noShowRate = denomNoShow > 0 ? Math.round((noShows / denomNoShow) * 100) : 0

  const peakHoursMap: Record<number, number> = {}
  for (const b of bookings) {
    if (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) {
      const h = b.startAt.getHours()
      peakHoursMap[h] = (peakHoursMap[h] ?? 0) + 1
    }
  }
  const peakHours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    count: peakHoursMap[h] ?? 0,
  }))

  const byDayMap: Record<string, number> = {}
  for (const b of bookings) {
    const day = b.createdAt.toISOString().slice(0, 10)
    byDayMap[day] = (byDayMap[day] ?? 0) + 1
  }
  const bookingsByDay = Object.entries(byDayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    total: bookings.length,
    confirmed,
    completed,
    noShows,
    rejected,
    cancelled,
    byStatus,
    revenue: Math.round(revenue),
    conversionRate,
    noShowRate,
    peakHours,
    bookingsByDay,
  }
}

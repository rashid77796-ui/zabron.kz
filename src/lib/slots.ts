/**
 * Generate TimeSlot[] for BookingCalendar from API resource data.
 * Preserves the existing BookingCalendar contract (TimeSlot interface).
 */
import type { TimeSlot } from '@/lib/types'
import { venueWallTimeToInstant, nowInVenueTz } from '@/lib/timezone'

type VenueHours = { dayOfWeek: number; openTime: string; closeTime: string }
type ConfirmedBooking = { startAt: string; endAt: string }
type Blackout = { startAt: string; endAt: string }

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const fromMin = (mins: number) => {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function generateSlotsFromResource(params: {
  resourceId: string
  venueId: string
  hours: VenueHours[]
  slotDurationMin: number
  confirmedBookings: ConfirmedBooking[]
  blackouts: Blackout[]
  daysAhead?: number
}): TimeSlot[] {
  const { resourceId, venueId, hours, slotDurationMin, confirmedBookings, blackouts, daysAhead = 14 } = params
  const slots: TimeSlot[] = []

  // Базовые «стенные» дата и день недели — в поясе заведения (Астана), а не браузера (правка #7).
  const base = nowInVenueTz()
  const baseAnchor = new Date(`${base.date}T12:00:00Z`) // полдень UTC как якорь — избегаем краевых эффектов

  for (let i = 0; i < daysAhead; i++) {
    const dayAnchor = new Date(baseAnchor)
    dayAnchor.setUTCDate(dayAnchor.getUTCDate() + i)
    const ds = dayAnchor.toISOString().slice(0, 10)
    const dayOfWeek = (base.dayOfWeek + i) % 7

    const dayHours = hours.find(h => h.dayOfWeek === dayOfWeek)
    if (!dayHours) continue

    const openMin = toMin(dayHours.openTime)
    let closeMin = toMin(dayHours.closeTime)
    // Support overnight: if close < open (e.g. 10:00 – 03:00), close is next day
    if (closeMin <= openMin) closeMin += 1440

    // Дата слота с учётом перехода через полночь: смещение в днях от базового дня.
    // Для ночных/круглосуточных смен слоты после полуночи попадают на следующий день,
    // а не на базовый (фикс: раньше дата бралась = базовому дню → бронь уезжала на 24ч).
    const dateForOffset = (offsetDays: number) => {
      const d = new Date(dayAnchor)
      d.setUTCDate(d.getUTCDate() + offsetDays)
      return d.toISOString().slice(0, 10)
    }

    let cur = openMin
    while (cur + slotDurationMin <= closeMin) {
      const endTotal = cur + slotDurationMin
      const startStr = fromMin(cur % 1440)
      const endStr = fromMin(endTotal % 1440)
      const startDate = dateForOffset(Math.floor(cur / 1440))
      const endDate = dateForOffset(Math.floor(endTotal / 1440))

      // Сравнение занятости — по абсолютным моментам в поясе заведения (правка #7)
      const slotStartDt = venueWallTimeToInstant(startDate, startStr)
      const slotEndDt = venueWallTimeToInstant(endDate, endStr)

      const isBooked = confirmedBookings.some(b => {
        const bs = new Date(b.startAt)
        const be = new Date(b.endAt)
        return bs < slotEndDt && be > slotStartDt
      })

      const isBlocked = blackouts.some(b => {
        const bs = new Date(b.startAt)
        const be = new Date(b.endAt)
        return bs < slotEndDt && be > slotStartDt
      })

      slots.push({
        id: `${resourceId}-${startDate}-${startStr}`,
        cabinId: resourceId,
        bathhouseId: venueId,
        date: startDate,
        startTime: startStr,
        endTime: endStr,
        maxGuests: 100, // will be capped by resource.capacity on the page
        status: isBooked || isBlocked ? 'booked' : 'free',
      })

      cur += slotDurationMin
    }
  }

  return slots
}

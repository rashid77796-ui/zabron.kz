import { nowInVenueTz } from '@/lib/timezone'

/**
 * Открыто/закрыто заведение сейчас — в поясе заведения (Asia/Almaty), правка #54.
 * - open           — открыто и до закрытия ещё далеко (бейдж не показываем)
 * - closing_soon   — открыто, но закроется в течение часа
 * - opens_later    — закрыто, но откроется ещё сегодня
 * - closed         — закрыто (до завтра или дальше)
 * - unknown        — часы не заданы
 */
export type VenueOpenStatus =
  | { state: 'open' }
  | { state: 'closing_soon'; minutesToClose: number }
  | { state: 'opens_later'; opensAt: string }
  | { state: 'closed' }
  | { state: 'unknown' }

export const CLOSING_SOON_THRESHOLD_MIN = 60

type Hours = { dayOfWeek: number; openTime: string; closeTime: string }

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function computeVenueStatus(
  hours: Hours[] | undefined | null,
  now: { minutes: number; dayOfWeek: number } = nowInVenueTz(),
): VenueOpenStatus {
  if (!hours || hours.length === 0) return { state: 'unknown' }
  const { minutes: nowMin, dayOfWeek } = now
  const prevDay = (dayOfWeek + 6) % 7

  // 1) Открыто ли сейчас — сегодняшние интервалы
  for (const h of hours.filter(h => h.dayOfWeek === dayOfWeek)) {
    const open = toMin(h.openTime)
    const close = toMin(h.closeTime)
    if (open === close) return { state: 'open' } // круглосуточно (00:00–00:00)
    const overnight = close <= open
    if (!overnight) {
      if (nowMin >= open && nowMin < close) {
        const left = close - nowMin
        return left <= CLOSING_SOON_THRESHOLD_MIN ? { state: 'closing_soon', minutesToClose: left } : { state: 'open' }
      }
    } else if (nowMin >= open) {
      // овернайт: открыто с open до полуночи сегодня
      const left = close + 1440 - nowMin
      return left <= CLOSING_SOON_THRESHOLD_MIN ? { state: 'closing_soon', minutesToClose: left } : { state: 'open' }
    }
  }

  // 2) Вчерашний овернайт, заходящий в сегодня до closeTime
  for (const h of hours.filter(h => h.dayOfWeek === prevDay)) {
    const open = toMin(h.openTime)
    const close = toMin(h.closeTime)
    if (open === close) return { state: 'open' }
    if (close <= open && nowMin < close) {
      const left = close - nowMin
      return left <= CLOSING_SOON_THRESHOLD_MIN ? { state: 'closing_soon', minutesToClose: left } : { state: 'open' }
    }
  }

  // 3) Закрыто. Откроется ли ещё сегодня?
  const laterToday = hours
    .filter(h => h.dayOfWeek === dayOfWeek && toMin(h.openTime) > nowMin)
    .map(h => h.openTime)
    .sort()
  if (laterToday.length > 0) return { state: 'opens_later', opensAt: laterToday[0] }

  return { state: 'closed' }
}

/** Человеческая подпись «через N минут / N ч M мин». */
export function formatMinutesLeft(min: number): string {
  if (min <= 1) return 'меньше минуты'
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

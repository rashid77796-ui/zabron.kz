/**
 * Единый часовой пояс заведений на этапе запуска — Астана (Asia/Almaty, UTC+5, без перехода на
 * летнее время). Все преобразования между «стенными часами» заведения (дата YYYY-MM-DD + время
 * HH:MM) и моментом времени (Date/UTC ISO) идут через этот модуль, а не через пояс браузера,
 * чтобы у пользователя из любого часового пояса сетка слотов и время брони совпадали с рабочими
 * часами заведения (правка #7). При расширении на другие регионы — хранить пояс у заведения.
 */

export const VENUE_TZ = 'Asia/Almaty'
export const VENUE_TZ_OFFSET = '+05:00'
export const VENUE_TZ_OFFSET_MIN = 5 * 60

/**
 * «Стенное» время заведения (дата + HH:MM) → момент времени (Date в UTC).
 * Использует фиксированное смещение пояса заведения, а не пояс браузера.
 */
export function venueWallTimeToInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${VENUE_TZ_OFFSET}`)
}

/**
 * Текущее «стенное» время в поясе заведения: дата (YYYY-MM-DD), минуты от полуночи и день недели.
 * Считаем через сдвиг UTC на фиксированное смещение (Алматы без DST).
 */
export function nowInVenueTz(): { date: string; minutes: number; dayOfWeek: number } {
  const shifted = new Date(Date.now() + VENUE_TZ_OFFSET_MIN * 60_000)
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    dayOfWeek: shifted.getUTCDay(),
  }
}

/** «Стенная» дата заведения для указанного момента (по умолчанию — сейчас). */
export function venueDateString(instant: Date = new Date()): string {
  return new Date(instant.getTime() + VENUE_TZ_OFFSET_MIN * 60_000).toISOString().slice(0, 10)
}

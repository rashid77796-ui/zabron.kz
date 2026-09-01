/**
 * Lightweight cron-style job runner.
 * On start, runs periodic tasks:
 *   - processAutoRejections: every 2 minutes
 *   - sendReminders: every 5 minutes
 *   - retryFailedNotifications: every 5 minutes (правка #41)
 *
 * Каждый тик защищён Postgres advisory-lock, поэтому при нескольких инстансах
 * задача выполняется ровно один раз за тик — нет дублей напоминаний и гонок (правка #42).
 * В дальнейшем можно заменить на BullMQ + Redis.
 */
import { processAutoRejections } from '@/server/services/booking'
import { notifyBookingRejected, notifyBookingReminder, notifyBookingConfirmed, retryFailedNotifications } from '@/server/services/notification'
import { prisma } from '@/server/db/client'
import { BookingStatus } from '@prisma/client'

let started = false

// Ключи advisory-lock для каждого типа задачи (правка #42)
const LOCK_AUTO_REJECT = 4210001
const LOCK_REMINDERS = 4210002
const LOCK_RETRY = 4210003

/**
 * Выполняет fn только если удалось взять распределённый лок (иначе тик уже выполняет
 * другой инстанс). Используем ТРАНЗАКЦИОННЫЙ advisory-lock (`pg_try_advisory_xact_lock`):
 * и захват, и работа идут в одной транзакции = на одном соединении, а лок автоматически
 * освобождается при завершении транзакции. Это надёжно с пулом соединений Prisma
 * (session-lock + отдельный unlock могли уйти на разные соединения и утечь).
 */
async function withAdvisoryLock(key: number, fn: () => Promise<void>) {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${key}) AS locked`
    if (!rows[0]?.locked) return // лок занят другим инстансом/тиком — пропускаем
    await fn()
    // xact-lock снимется автоматически при коммите транзакции
  }, { timeout: 120_000, maxWait: 10_000 })
}

export function startScheduler() {
  if (started) return
  started = true

  // Auto-reject expired PENDING bookings every 2 min
  setInterval(() => {
    withAdvisoryLock(LOCK_AUTO_REJECT, async () => {
      const { rejected, confirmed } = await processAutoRejections()
      if (rejected.length > 0) {
        console.log(`[scheduler] auto-rejected ${rejected.length} bookings`)
        for (const id of rejected) {
          await notifyBookingRejected(id, 'AUTO_REJECTED').catch(() => {})
        }
      }
      if (confirmed.length > 0) {
        console.log(`[scheduler] auto-confirmed ${confirmed.length} bookings`)
        for (const id of confirmed) {
          await notifyBookingConfirmed(id).catch(() => {})
        }
      }
    }).catch(e => console.error('[scheduler] auto-reject error:', e))
  }, 2 * 60 * 1000)

  // Send reminders every 5 min
  setInterval(() => {
    withAdvisoryLock(LOCK_REMINDERS, async () => {
      const now = new Date()
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const in24hPlus5m = new Date(in24h.getTime() + 5 * 60 * 1000)
      const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)
      const in2hPlus5m = new Date(in2h.getTime() + 5 * 60 * 1000)

      // Bookings starting in ~24 hours — skip those already notified
      const dayBookings = await prisma.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          startAt: { gte: in24h, lt: in24hPlus5m },
        },
        select: { id: true },
      })
      // Fetch sent T1D reminders from the last 25h and deduplicate in memory
      const sentT1D = await prisma.notification.findMany({
        where: { type: 'REMINDER_T1D', createdAt: { gte: new Date(now.getTime() - 25 * 60 * 60 * 1000) } },
        select: { payload: true },
      })
      const alreadyNotifiedT1D = new Set(
        sentT1D.map(n => (n.payload as { bookingId?: string }).bookingId).filter(Boolean)
      )
      const dayReminders = dayBookings.filter(b => !alreadyNotifiedT1D.has(b.id))

      // Bookings starting in ~2 hours — skip those already notified
      const hourBookings = await prisma.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          startAt: { gte: in2h, lt: in2hPlus5m },
        },
        select: { id: true },
      })
      // Fetch sent T2H reminders from the last 3h and deduplicate in memory
      const sentT2H = await prisma.notification.findMany({
        where: { type: 'REMINDER_T2H', createdAt: { gte: new Date(now.getTime() - 3 * 60 * 60 * 1000) } },
        select: { payload: true },
      })
      const alreadyNotifiedT2H = new Set(
        sentT2H.map(n => (n.payload as { bookingId?: string }).bookingId).filter(Boolean)
      )
      const hourReminders = hourBookings.filter(b => !alreadyNotifiedT2H.has(b.id))

      for (const b of [...dayReminders, ...hourReminders]) {
        await notifyBookingReminder(b.id).catch(() => {})
      }
    }).catch(e => console.error('[scheduler] reminder error:', e))
  }, 5 * 60 * 1000)

  // Retry failed notifications every 5 min (правка #41)
  setInterval(() => {
    withAdvisoryLock(LOCK_RETRY, async () => {
      await retryFailedNotifications()
    }).catch(e => console.error('[scheduler] retry error:', e))
  }, 5 * 60 * 1000)

  console.log('[scheduler] started')
}

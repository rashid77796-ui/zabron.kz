import { Resend } from 'resend'
import { prisma } from '@/server/db/client'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM ?? 'Zabron <noreply@zabron.kz>'
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// ─── Low-level senders ───────────────────────────────────────────────────────

// Результат попытки отправки по каналу (правка #41)
type SendResult = { ok: boolean; error?: string }

async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  if (!resend) {
    console.warn('[notify] Resend not configured, skipping email to', to)
    // Канал выключен — не считаем ошибкой, чтобы не порождать бесконечные ретраи
    return { ok: true }
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
    return { ok: true }
  } catch (e) {
    console.error('[notify] Email send error:', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function sendTelegram(chatId: string, text: string, replyMarkup?: object): Promise<SendResult> {
  if (!BOT_TOKEN) {
    console.warn('[notify] Telegram not configured, skipping message to', chatId)
    return { ok: true }
  }
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }
    if (replyMarkup) body.reply_markup = replyMarkup
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, error: `Telegram HTTP ${res.status}` }
    return { ok: true }
  } catch (e) {
    console.error('[notify] Telegram send error:', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function persistNotification(params: {
  userId: string
  type: string
  channel: 'EMAIL' | 'TELEGRAM'
  payload: object
  sendAt?: Date
  result?: SendResult // статус доставки внешнего канала (правка #41)
}) {
  const delivered = params.result?.ok ?? true
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      channel: params.channel,
      payload: params.payload,
      sendAt: params.sendAt,
      // Отложенные (sendAt в будущем) — PENDING; иначе фиксируем итог попытки
      sentAt: params.sendAt ? undefined : (delivered ? new Date() : null),
      deliveryStatus: params.sendAt ? 'PENDING' : (delivered ? 'SENT' : 'FAILED'),
      attempts: params.sendAt ? 0 : 1,
      lastError: params.result?.error ?? null,
    },
  })

  // Web-push — один раз на получателя (на EMAIL-канал), тихий no-op без VAPID (правка #44)
  if (!params.sendAt && params.channel === 'EMAIL') {
    const tpl = RETRY_TEXT[params.type] ?? { subject: 'Zabron', body: 'У вас новое уведомление' }
    const bookingId = (params.payload as { bookingId?: string }).bookingId
    import('./push')
      .then(m => m.sendPushToUser(params.userId, {
        title: tpl.subject,
        body: tpl.body,
        url: bookingId ? `/dashboard?booking=${bookingId}` : '/dashboard',
      }))
      .catch(() => {})
  }
}

// ─── HTML email templates ─────────────────────────────────────────────────────

function bookingEmailHtml(params: {
  title: string
  body: string
  ctaText?: string
  ctaUrl?: string
}) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:24px;color:#111">
<h2 style="color:#7101F1">${params.title}</h2>
<p>${params.body}</p>
${params.ctaText && params.ctaUrl ? `<a href="${params.ctaUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#7101F1;color:#fff;border-radius:8px;text-decoration:none">${params.ctaText}</a>` : ''}
<hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
<p style="font-size:12px;color:#999">Zabron — онлайн-бронирование мест отдыха в Казахстане</p>
</body></html>`
}

// ─── Notification triggers ────────────────────────────────────────────────────

export async function notifyBookingCreated(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      client: true,
      resource: { include: { venue: { include: { merchant: { include: { owner: { include: { telegram: true } } } } } } } },
    },
  })
  if (!booking) return

  const venue = booking.resource.venue
  const merchant = venue.merchant.owner
  const startAt = booking.startAt.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

  // Email to merchant
  const emailRes = await sendEmail(
    merchant.email,
    `Новая заявка — ${venue.name}`,
    bookingEmailHtml({
      title: 'Новая заявка на бронирование',
      body: `<b>${booking.client.name}</b> хочет забронировать <b>${booking.resource.name}</b> в заведении <b>${venue.name}</b>.<br/>
             Дата: <b>${startAt}</b>, гостей: <b>${booking.guests}</b>${booking.comment ? `<br/>Комментарий: ${booking.comment}` : ''}`,
      ctaText: 'Открыть кабинет',
      ctaUrl: `${process.env.BETTER_AUTH_URL}/owner`,
    })
  )
  await persistNotification({ userId: merchant.id, type: 'BOOKING_NEW', channel: 'EMAIL', payload: { bookingId }, result: emailRes })

  // Telegram to merchant (with inline buttons)
  if (merchant.telegram) {
    const text = `📅 <b>Новая заявка</b>\n\n` +
      `👤 ${booking.client.name}${booking.client.phone ? ` · ${booking.client.phone}` : ''}\n` +
      `🏠 ${venue.name} — ${booking.resource.name}\n` +
      `🕐 ${startAt}, ${booking.guests} чел.` +
      (booking.comment ? `\n💬 ${booking.comment}` : '')

    const tgRes = await sendTelegram(merchant.telegram.chatId, text, {
      inline_keyboard: [[
        { text: '✅ Подтвердить', callback_data: `confirm:${bookingId}` },
        { text: '❌ Отклонить', callback_data: `reject:${bookingId}` },
      ]],
    })
    await persistNotification({ userId: merchant.id, type: 'BOOKING_NEW', channel: 'TELEGRAM', payload: { bookingId }, result: tgRes })
  }
}

export async function notifyBookingConfirmed(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      client: { include: { telegram: true } },
      resource: { include: { venue: true } },
    },
  })
  if (!booking) return

  const venue = booking.resource.venue
  const startAt = booking.startAt.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  const code = booking.checkInCode ?? ''

  const cEmailRes = await sendEmail(
    booking.client.email,
    `Бронь подтверждена — ${venue.name}`,
    bookingEmailHtml({
      title: '✅ Ваша бронь подтверждена!',
      body: `<b>${booking.resource.name}</b> в <b>${venue.name}</b><br/>
             Дата: <b>${startAt}</b>, гостей: <b>${booking.guests}</b><br/><br/>
             Код для входа: <b style="font-size:24px;letter-spacing:4px">${code}</b>`,
    })
  )
  await persistNotification({ userId: booking.clientUserId, type: 'BOOKING_CONFIRMED', channel: 'EMAIL', payload: { bookingId }, result: cEmailRes })

  if (booking.client.telegram) {
    const cTgRes = await sendTelegram(
      booking.client.telegram.chatId,
      `✅ <b>Бронь подтверждена!</b>\n\n🏠 ${venue.name} — ${booking.resource.name}\n🕐 ${startAt}\n\n🔑 Код входа: <b>${code}</b>`
    )
    await persistNotification({ userId: booking.clientUserId, type: 'BOOKING_CONFIRMED', channel: 'TELEGRAM', payload: { bookingId }, result: cTgRes })
  }
}

export async function notifyBookingRejected(bookingId: string, reason: 'REJECTED' | 'AUTO_REJECTED' | 'SLOT_TAKEN') {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      client: { include: { telegram: true } },
      resource: { include: { venue: true } },
    },
  })
  if (!booking) return

  const venue = booking.resource.venue
  const startAt = booking.startAt.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

  const reasonText = reason === 'SLOT_TAKEN'
    ? 'Слот занят другой бронью'
    : reason === 'AUTO_REJECTED'
    ? 'Владелец не успел рассмотреть заявку вовремя'
    : 'Владелец отклонил заявку'

  const rEmailRes = await sendEmail(
    booking.client.email,
    `Заявка отклонена — ${venue.name}`,
    bookingEmailHtml({
      title: '❌ Заявка не подтверждена',
      body: `Ваша заявка на <b>${booking.resource.name}</b> в <b>${venue.name}</b> (${startAt}) не была подтверждена.<br/>
             Причина: ${reasonText}<br/><br/>Попробуйте выбрать другое время.`,
      ctaText: 'Выбрать другое время',
      ctaUrl: `${process.env.BETTER_AUTH_URL}/venues/${venue.id}`,
    })
  )
  await persistNotification({ userId: booking.clientUserId, type: `BOOKING_${reason}`, channel: 'EMAIL', payload: { bookingId }, result: rEmailRes })

  if (booking.client.telegram) {
    await sendTelegram(
      booking.client.telegram.chatId,
      `❌ <b>Заявка отклонена</b>\n\n🏠 ${venue.name} — ${booking.resource.name}\n🕐 ${startAt}\n\nПричина: ${reasonText}`
    )
  }
}

export async function notifyBookingReminder(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      client: { include: { telegram: true } },
      resource: { include: { venue: true } },
    },
  })
  if (!booking) return

  const venue = booking.resource.venue
  const startAt = booking.startAt.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

  await sendEmail(
    booking.client.email,
    `Напоминание о брони — ${venue.name}`,
    bookingEmailHtml({
      title: '⏰ Напоминание о бронировании',
      body: `Не забудьте: <b>${booking.resource.name}</b> в <b>${venue.name}</b> — <b>${startAt}</b>.<br/>
             Код для входа: <b style="font-size:24px;letter-spacing:4px">${booking.checkInCode ?? ''}</b>`,
    })
  )

  if (booking.client.telegram) {
    await sendTelegram(
      booking.client.telegram.chatId,
      `⏰ <b>Напоминание</b>\n\n🏠 ${venue.name} — ${booking.resource.name}\n🕐 ${startAt}\n\n🔑 Код: <b>${booking.checkInCode ?? ''}</b>`
    )
  }
}

// Уведомление админам/модераторам о новой заявке на модерацию заведения (правка #7).
export async function notifyVenueSubmittedForReview(venueId: string) {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { merchant: { include: { owner: { select: { name: true, email: true } } } } },
  })
  if (!venue) return

  const admins = await prisma.user.findMany({
    where: { role: { in: ['super_admin', 'moderator'] } },
    include: { telegram: true },
  })

  const ownerName = venue.merchant.owner.name
  const ownerEmail = venue.merchant.owner.email

  for (const admin of admins) {
    const mEmailRes = await sendEmail(
      admin.email,
      `На модерацию: ${venue.name}`,
      bookingEmailHtml({
        title: '🕵️ Новая заявка на модерацию',
        body: `Заведение <b>${venue.name}</b> отправлено на модерацию.<br/>Владелец: ${ownerName} · ${ownerEmail}`,
        ctaText: 'Открыть модерацию',
        ctaUrl: `${process.env.BETTER_AUTH_URL}/admin`,
      })
    )
    await persistNotification({ userId: admin.id, type: 'MODERATION_NEW', channel: 'EMAIL', payload: { venueId }, result: mEmailRes })

    if (admin.telegram) {
      const mTgRes = await sendTelegram(
        admin.telegram.chatId,
        `🕵️ <b>На модерацию</b>\n\n🏠 ${venue.name}\n👤 ${ownerName} · ${ownerEmail}`
      )
      await persistNotification({ userId: admin.id, type: 'MODERATION_NEW', channel: 'TELEGRAM', payload: { venueId }, result: mTgRes })
    }
  }
}

// ─── Telegram webhook handler (inline button callbacks) ───────────────────────

export async function handleTelegramCallback(callbackQuery: {
  id: string
  from: { id: number }
  data?: string
  message?: { chat: { id: number } }
}) {
  if (!callbackQuery.data || !BOT_TOKEN) return

  const [action, bookingId] = callbackQuery.data.split(':')
  if (!bookingId) return

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { resource: { include: { venue: { include: { merchant: { include: { owner: true } } } } } } },
  })
  if (!booking) return

  const merchantTelegramId = String(callbackQuery.from.id)
  const telegramLink = await prisma.telegramLink.findFirst({ where: { chatId: merchantTelegramId } })
  if (!telegramLink || telegramLink.userId !== booking.resource.venue.merchant.ownerUserId) return

  const { confirmBooking, rejectBooking } = await import('./booking')

  try {
    if (action === 'confirm') {
      await confirmBooking(bookingId, booking.resource.venue.merchant.ownerUserId)
      await notifyBookingConfirmed(bookingId)
      await answerCallback(callbackQuery.id, '✅ Бронь подтверждена')
    } else if (action === 'reject') {
      await rejectBooking(bookingId, booking.resource.venue.merchant.ownerUserId)
      await notifyBookingRejected(bookingId, 'REJECTED')
      await answerCallback(callbackQuery.id, '❌ Бронь отклонена')
    }
  } catch {
    await answerCallback(callbackQuery.id, '⚠️ Ошибка — возможно статус уже изменён')
  }
}

async function answerCallback(callbackQueryId: string, text: string) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
}

// ─── Повторная доставка недоставленных уведомлений (правка #41) ────────────────

// Краткие тексты для ретрая (оригинальный шаблон не храним — цель ретрая доставить факт)
const RETRY_TEXT: Record<string, { subject: string; body: string }> = {
  BOOKING_NEW: { subject: 'Новая заявка на бронирование', body: 'Поступила новая заявка на бронирование. Откройте кабинет Zabron.' },
  BOOKING_CONFIRMED: { subject: 'Бронь подтверждена', body: 'Ваша бронь подтверждена. Подробности — в кабинете Zabron.' },
  BOOKING_REJECTED: { subject: 'Заявка отклонена', body: 'Ваша заявка не была подтверждена. Попробуйте другое время.' },
  BOOKING_AUTO_REJECTED: { subject: 'Заявка отклонена', body: 'Ваша заявка не была подтверждена вовремя.' },
  BOOKING_SLOT_TAKEN: { subject: 'Слот занят', body: 'Выбранный слот оказался занят. Попробуйте другое время.' },
  MODERATION_NEW: { subject: 'Новая заявка на модерацию', body: 'Есть новая заявка на модерацию заведения.' },
}

/**
 * Повторно отправляет уведомления со статусом FAILED (email/telegram) до MAX_ATTEMPTS.
 * Обновляет существующую запись (без дублей). Вызывается планировщиком (правка #41).
 */
export async function retryFailedNotifications() {
  const MAX_ATTEMPTS = 3
  const failed = await prisma.notification.findMany({
    where: { deliveryStatus: 'FAILED', attempts: { lt: MAX_ATTEMPTS } },
    include: { user: { include: { telegram: true } } },
    take: 50,
    orderBy: { createdAt: 'asc' },
  })

  for (const n of failed) {
    const tpl = RETRY_TEXT[n.type] ?? { subject: 'Уведомление Zabron', body: 'У вас новое уведомление в Zabron.' }
    let res: SendResult
    if (n.channel === 'EMAIL') {
      res = await sendEmail(n.user.email, tpl.subject, bookingEmailHtml({ title: tpl.subject, body: tpl.body }))
    } else if (n.user.telegram) {
      res = await sendTelegram(n.user.telegram.chatId, `<b>${tpl.subject}</b>\n\n${tpl.body}`)
    } else {
      res = { ok: false, error: 'NO_TELEGRAM_LINK' }
    }

    await prisma.notification.update({
      where: { id: n.id },
      data: {
        attempts: { increment: 1 },
        deliveryStatus: res.ok ? 'SENT' : 'FAILED',
        sentAt: res.ok ? new Date() : null,
        lastError: res.error ?? null,
      },
    })
  }
}

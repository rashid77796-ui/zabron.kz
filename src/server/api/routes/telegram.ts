import { Hono } from 'hono'
import { handleTelegramCallback } from '@/server/services/notification'
import { prisma } from '@/server/db/client'

const app = new Hono()

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Admin: register / inspect webhook
app.post('/setup', async (c) => {
  const { auth } = await import('@/server/auth/auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (session?.user?.role !== 'super_admin') return c.json({ error: 'FORBIDDEN' }, 403)

  if (!BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, 500)

  const appUrl = process.env.BETTER_AUTH_URL
  if (!appUrl || appUrl.includes('localhost')) {
    return c.json({ error: 'BETTER_AUTH_URL must be a public HTTPS URL, not localhost' }, 400)
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
  })
  const data = await res.json() as { ok: boolean; description?: string }
  return c.json({ webhookUrl, telegram: data })
})

app.get('/setup', async (c) => {
  const { auth } = await import('@/server/auth/auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (session?.user?.role !== 'super_admin') return c.json({ error: 'FORBIDDEN' }, 403)

  if (!BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, 500)

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
  const data = await res.json()
  return c.json(data)
})

// Telegram sends all updates here (set via setWebhook)
app.post('/webhook', async (c) => {
  const update = await c.req.json()

  if (update.callback_query) {
    await handleTelegramCallback(update.callback_query).catch(e =>
      console.error('[telegram] callback error:', e)
    )
  }

  if (update.message?.text) {
    await handleMessage(update.message).catch(e =>
      console.error('[telegram] message error:', e)
    )
  }

  return c.json({ ok: true })
})

// Returns the deep-link URL for the current user to link their Telegram
app.get('/link', async (c) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!botUsername) return c.json({ url: null, message: 'Bot username not configured' })

  // Extract userId from Better Auth session
  const { auth } = await import('@/server/auth/auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: 'UNAUTHORIZED' }, 401)

  const linked = await prisma.telegramLink.findUnique({ where: { userId: session.user.id } })
  return c.json({
    linked: !!linked,
    url: `https://t.me/${botUsername}?start=${session.user.id}`,
  })
})

async function handleMessage(message: {
  text: string
  chat: { id: number }
  from: { id: number }
}) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) return

  const chatId = String(message.chat.id)

  if (message.text.startsWith('/start')) {
    const parts = message.text.split(' ')
    const userId = parts[1]?.trim()

    if (!userId) {
      await reply(chatId, '👋 Привет! Чтобы привязать аккаунт, перейдите по ссылке из кабинета на сайте.')
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    if (!user) {
      await reply(chatId, '❌ Ссылка недействительна. Сгенерируйте новую в настройках.')
      return
    }

    // Upsert the link
    await prisma.telegramLink.upsert({
      where: { userId },
      update: { chatId },
      create: { userId, chatId },
    })

    await reply(chatId, `✅ <b>Аккаунт привязан!</b>\n\nПривет, ${user.name}! Теперь вы будете получать уведомления о бронированиях здесь.`)
    return
  }

  if (message.text === '/stop') {
    const link = await prisma.telegramLink.findFirst({ where: { chatId } })
    if (link) {
      await prisma.telegramLink.delete({ where: { id: link.id } })
      await reply(chatId, '🔕 Привязка Telegram отключена. Уведомления будут приходить только на email.')
    } else {
      await reply(chatId, 'Привязки нет.')
    }
    return
  }
}

async function reply(chatId: string, text: string) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export default app

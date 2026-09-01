import { prisma } from '@/server/db/client'
import { WaitlistStatus } from '@prisma/client'

export async function joinWaitlist(params: {
  resourceId: string
  clientUserId: string
  desiredStart: Date
}) {
  const existing = await prisma.waitlistEntry.findFirst({
    where: { resourceId: params.resourceId, clientUserId: params.clientUserId, status: WaitlistStatus.ACTIVE },
  })
  if (existing) throw new Error('ALREADY_ON_WAITLIST')

  return prisma.waitlistEntry.create({
    data: { ...params, status: WaitlistStatus.ACTIVE },
    include: { resource: { include: { venue: { include: { category: true } } } } },
  })
}

export async function leaveWaitlist(entryId: string, clientUserId: string) {
  const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.clientUserId !== clientUserId) throw new Error('FORBIDDEN')
  return prisma.waitlistEntry.update({ where: { id: entryId }, data: { status: WaitlistStatus.EXPIRED } })
}

export async function listClientWaitlist(clientUserId: string) {
  return prisma.waitlistEntry.findMany({
    where: { clientUserId, status: WaitlistStatus.ACTIVE },
    include: { resource: { include: { venue: { include: { category: true } } } } },
    orderBy: { createdAt: 'asc' },
  })
}

/** Called when a CONFIRMED booking is cancelled — notify waiting clients for nearby time. */
export async function notifyWaitlistOnSlotFreed(resourceId: string, freedStart: Date) {
  const window = 2 * 60 * 60 * 1000 // ±2h window
  const entries = await prisma.waitlistEntry.findMany({
    where: {
      resourceId,
      status: WaitlistStatus.ACTIVE,
      desiredStart: {
        gte: new Date(freedStart.getTime() - window),
        lte: new Date(freedStart.getTime() + window),
      },
    },
    include: {
      client: { include: { telegram: true } },
      resource: { include: { venue: true } },
    },
  })

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const baseUrl = process.env.BETTER_AUTH_URL ?? ''

  for (const entry of entries) {
    await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { status: WaitlistStatus.NOTIFIED } })

    const venue = entry.resource.venue
    const timeStr = freedStart.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

    if (entry.client.telegram && BOT_TOKEN) {
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: entry.client.telegram.chatId,
          text: `🔔 <b>Слот освободился!</b>\n\n🏠 ${venue.name} — ${entry.resource.name}\n🕐 ${timeStr}\n\n<a href="${baseUrl}/venues/${venue.id}">Забронировать</a>`,
          parse_mode: 'HTML',
        }),
      }).catch(() => {})
    }
  }
}

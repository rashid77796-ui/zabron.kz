import { prisma } from '@/server/db/client'
import { ContentStatus, ModerationStatus } from '@prisma/client'
import { writeAuditLog } from './admin'

export async function submitVenueForReview(venueId: string, submittedBy: string) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } })
  if (!venue) throw new Error('NOT_FOUND')

  const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: submittedBy } })
  if (!merchant || venue.merchantId !== merchant.id) throw new Error('FORBIDDEN')

  if (
    venue.contentStatus !== ContentStatus.DRAFT &&
    venue.contentStatus !== ContentStatus.REJECTED &&
    venue.contentStatus !== ContentStatus.NEEDS_REVISION
  ) {
    throw new Error('INVALID_STATUS')
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.venue.update({ where: { id: venueId }, data: { contentStatus: ContentStatus.PENDING_REVIEW } })
    return tx.moderationRequest.create({
      data: {
        entityType: 'venue',
        entityId: venueId,
        proposedData: JSON.parse(JSON.stringify(venue)),
        status: ModerationStatus.PENDING,
        submittedBy,
      },
    })
  })
  // Уведомляем админов/модераторов о новой заявке (правка #7). Fire-and-forget.
  import('./notification').then(m => m.notifyVenueSubmittedForReview(venueId)).catch(() => {})
  return result
}

export async function listModerationRequests(params: {
  status?: ModerationStatus
  page?: number
} = {}) {
  const { status = ModerationStatus.PENDING, page = 1 } = params
  const take = 20
  const skip = (page - 1) * take

  const [items, total] = await Promise.all([
    prisma.moderationRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
    prisma.moderationRequest.count({ where: { status } }),
  ])

  const enriched = await Promise.all(items.map(async (req) => {
    if (req.entityType === 'venue') {
      const venue = await prisma.venue.findUnique({
        where: { id: req.entityId },
        include: {
          category: true,
          resources: true,
          hours: { orderBy: { dayOfWeek: 'asc' } },
          merchant: { include: { owner: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } } },
        },
      })
      // Показываем модератору предлагаемую (новую) версию контента — правка #9.
      const p = (req.proposedData ?? {}) as { name?: unknown; description?: unknown; photos?: unknown }
      const merged = venue
        ? {
            ...venue,
            ...(typeof p.name === 'string' ? { name: p.name } : {}),
            ...(typeof p.description === 'string' ? { description: p.description } : {}),
            ...(Array.isArray(p.photos) ? { photos: p.photos as string[] } : {}),
          }
        : null
      // Текущий (живой) контент до слияния — для diff «было → стало» правок опубликованного заведения (правка #23).
      // Для первичной публикации venue.* == proposedData, поэтому клиент показывает diff только для PUBLISHED.
      const currentContent = venue
        ? { name: venue.name, description: venue.description, photos: venue.photos }
        : null
      return { ...req, venue: merged, currentContent }
    }
    return { ...req, venue: null, currentContent: null }
  }))

  return { items: enriched, total, page, pages: Math.ceil(total / take) }
}

/** Все заявки на модерацию по заведениям мерчанта — история для кабинета. */
export async function listMerchantModerationRequests(userId: string) {
  const merchant = await prisma.merchant.findUnique({ where: { ownerUserId: userId } })
  if (!merchant) return []

  const venues = await prisma.venue.findMany({
    where: { merchantId: merchant.id },
    select: { id: true, name: true },
  })
  if (venues.length === 0) return []

  const nameById = new Map(venues.map(v => [v.id, v.name]))
  const requests = await prisma.moderationRequest.findMany({
    where: { entityType: 'venue', entityId: { in: venues.map(v => v.id) } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, entityId: true, status: true, note: true, createdAt: true, reviewedAt: true },
  })

  return requests.map(r => ({ ...r, venueName: nameById.get(r.entityId) ?? null }))
}

export async function approveModeration(requestId: string, reviewedBy: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.moderationRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new Error('NOT_FOUND')
    if (request.status !== ModerationStatus.PENDING) throw new Error('INVALID_STATUS')

    if (request.entityType === 'venue') {
      // Применяем предложенную (новую) версию контента и публикуем (правка #9).
      const p = (request.proposedData ?? {}) as { name?: unknown; description?: unknown; photos?: unknown }
      await tx.venue.update({
        where: { id: request.entityId },
        data: {
          contentStatus: ContentStatus.PUBLISHED,
          ...(typeof p.name === 'string' ? { name: p.name } : {}),
          ...(typeof p.description === 'string' ? { description: p.description } : {}),
          ...(Array.isArray(p.photos) ? { photos: p.photos as string[] } : {}),
        },
      })
    }

    const result = await tx.moderationRequest.update({
      where: { id: requestId },
      data: { status: ModerationStatus.APPROVED, reviewedBy, reviewedAt: new Date() },
    })
    await writeAuditLog(reviewedBy, 'moderation.approve', 'ModerationRequest', requestId, {
      entityType: request.entityType,
      entityId: request.entityId,
    })
    return result
  })
}

/** Вернуть заявку мерчанту на доработку — мягче отклонения: заведение можно отредактировать и переотправить. */
export async function requestVenueRevision(requestId: string, reviewedBy: string, note: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.moderationRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new Error('NOT_FOUND')
    if (request.status !== ModerationStatus.PENDING) throw new Error('INVALID_STATUS')

    if (request.entityType === 'venue') {
      // Доработка правки уже опубликованного заведения не убирает живую версию (правка #9).
      const v = await tx.venue.findUnique({ where: { id: request.entityId }, select: { contentStatus: true } })
      if (v && v.contentStatus !== ContentStatus.PUBLISHED) {
        await tx.venue.update({ where: { id: request.entityId }, data: { contentStatus: ContentStatus.NEEDS_REVISION } })
      }
    }

    const result = await tx.moderationRequest.update({
      where: { id: requestId },
      data: { status: ModerationStatus.NEEDS_REVISION, reviewedBy, reviewedAt: new Date(), note },
    })
    await writeAuditLog(reviewedBy, 'moderation.revision', 'ModerationRequest', requestId, {
      entityType: request.entityType,
      entityId: request.entityId,
      note,
    })
    return result
  })
}

export async function rejectModeration(requestId: string, reviewedBy: string, note: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.moderationRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new Error('NOT_FOUND')
    if (request.status !== ModerationStatus.PENDING) throw new Error('INVALID_STATUS')

    if (request.entityType === 'venue') {
      // Отклонение правки уже опубликованного заведения не убирает живую версию (правка #9).
      const v = await tx.venue.findUnique({ where: { id: request.entityId }, select: { contentStatus: true } })
      if (v && v.contentStatus !== ContentStatus.PUBLISHED) {
        await tx.venue.update({ where: { id: request.entityId }, data: { contentStatus: ContentStatus.REJECTED } })
      }
    }

    const result = await tx.moderationRequest.update({
      where: { id: requestId },
      data: { status: ModerationStatus.REJECTED, reviewedBy, reviewedAt: new Date(), note },
    })
    await writeAuditLog(reviewedBy, 'moderation.reject', 'ModerationRequest', requestId, {
      entityType: request.entityType,
      entityId: request.entityId,
      note,
    })
    return result
  })
}

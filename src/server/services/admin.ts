import { prisma } from '@/server/db/client'
import { MerchantStatus, Prisma } from '@prisma/client'

export async function writeAuditLog(
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      entityType,
      entityId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

// ─── Merchants ─────────────────────────────────────────────────────────────────

export async function listMerchants(params?: { status?: MerchantStatus; page?: number; perPage?: number }) {
  const page = params?.page ?? 1
  const perPage = params?.perPage ?? 20
  const where = params?.status ? { status: params.status } : {}

  const [items, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, email: true, createdAt: true } },
        venues: { select: { id: true, name: true, contentStatus: true } },
      },
    }),
    prisma.merchant.count({ where }),
  ])

  return { items, total, page, pages: Math.ceil(total / perPage) }
}

export async function activateMerchant(
  merchantId: string,
  actorUserId: string,
  deal?: { dealAmount?: number; dealCurrency?: string; dealPlan?: string; expiresAt?: Date },
) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } })
  if (!merchant) throw new Error('NOT_FOUND')

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      status: MerchantStatus.ACTIVE,
      activatedAt: new Date(),
      dealAmount: deal?.dealAmount,
      dealCurrency: deal?.dealCurrency ?? 'KZT',
      dealPlan: deal?.dealPlan,
      expiresAt: deal?.expiresAt,
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  })

  await writeAuditLog(actorUserId, 'merchant.activate', 'Merchant', merchantId, {
    previousStatus: merchant.status,
    deal,
  })

  return updated
}

export async function suspendMerchant(merchantId: string, actorUserId: string, reason?: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } })
  if (!merchant) throw new Error('NOT_FOUND')

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: MerchantStatus.SUSPENDED },
    include: { owner: { select: { id: true, name: true, email: true } } },
  })

  await writeAuditLog(actorUserId, 'merchant.suspend', 'Merchant', merchantId, {
    previousStatus: merchant.status,
    reason,
  })

  return updated
}

export async function setMerchantFeatured(merchantId: string, actorUserId: string, featuredUntil: Date | null) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } })
  if (!merchant) throw new Error('NOT_FOUND')

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { featuredUntil },
  })

  await writeAuditLog(actorUserId, 'merchant.setFeatured', 'Merchant', merchantId, { featuredUntil })
  return updated
}

// ─── Platform metrics ──────────────────────────────────────────────────────────

export async function getPlatformMetrics() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    merchantsByStatus,
    userCount,
    bookingsToday,
    bookingsThisMonth,
  ] = await Promise.all([
    prisma.merchant.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count(),
    prisma.booking.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.booking.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: {
        startAt: true,
        endAt: true,
        resource: { select: { pricePerHour: true, price: true } },
      },
    }),
  ])

  const merchantCounts = { PENDING: 0, ACTIVE: 0, SUSPENDED: 0 }
  for (const row of merchantsByStatus) {
    merchantCounts[row.status as keyof typeof merchantCounts] = row._count._all
  }

  const revenueThisMonth = bookingsThisMonth.reduce((sum, b) => {
    if (b.resource.price) return sum + b.resource.price
    if (b.resource.pricePerHour) {
      const hours = (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000
      return sum + Math.round(b.resource.pricePerHour * hours)
    }
    return sum
  }, 0)

  return {
    merchants: merchantCounts,
    userCount,
    bookingsToday,
    revenueThisMonth,
  }
}

// ─── Users ─────────────────────────────────────────────────────────────────────

export async function listUsers(params?: { page?: number; perPage?: number; search?: string; role?: string }) {
  const page = params?.page ?? 1
  const perPage = params?.perPage ?? 20
  const where: Prisma.UserWhereInput = {}
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ]
  }
  if (params?.role) where.role = params.role // фильтр по роли (правка #28)

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        merchant: { select: { id: true, status: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return { items, total, page, pages: Math.ceil(total / perPage) }
}

export async function setUserRole(userId: string, role: string, actorUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
  if (!user) throw new Error('NOT_FOUND')

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  })

  await writeAuditLog(actorUserId, 'user.setRole', 'User', userId, {
    previousRole: user.role,
    newRole: role,
  })

  return updated
}

// ─── Audit log ─────────────────────────────────────────────────────────────────

export async function listAuditLogs(params?: { page?: number; perPage?: number; entityType?: string }) {
  const page = params?.page ?? 1
  const perPage = params?.perPage ?? 50
  const where = params?.entityType ? { entityType: params.entityType } : {}

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ])

  // AuditLog не имеет связи с User — подтягиваем авторов отдельно и джойним в памяти (правка #26).
  const actorIds = [...new Set(items.map(i => i.actorUserId).filter((x): x is string => !!x))]
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true, role: true },
      })
    : []
  const actorById = new Map(actors.map(a => [a.id, a]))

  const enriched = items.map(i => ({
    ...i,
    actor: i.actorUserId ? actorById.get(i.actorUserId) ?? null : null,
  }))

  return { items: enriched, total, page, pages: Math.ceil(total / perPage) }
}

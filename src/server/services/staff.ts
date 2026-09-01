import { prisma } from '@/server/db/client'

export async function listStaff(merchantId: string) {
  return prisma.merchantStaff.findMany({
    where: { merchantId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { id: 'asc' },
  })
}

export async function addStaff(merchantId: string, email: string, permissions: string[]) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('USER_NOT_FOUND')

  const existing = await prisma.merchantStaff.findUnique({
    where: { merchantId_userId: { merchantId, userId: user.id } },
  })
  if (existing) throw new Error('ALREADY_STAFF')

  return prisma.merchantStaff.create({
    data: { merchantId, userId: user.id, permissions },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  })
}

export async function removeStaff(staffId: string, merchantId: string) {
  const record = await prisma.merchantStaff.findUnique({ where: { id: staffId } })
  if (!record || record.merchantId !== merchantId) throw new Error('NOT_FOUND')
  return prisma.merchantStaff.delete({ where: { id: staffId } })
}

export async function getMerchantIdForOwner(ownerUserId: string) {
  const merchant = await prisma.merchant.findUnique({ where: { ownerUserId } })
  return merchant?.id ?? null
}

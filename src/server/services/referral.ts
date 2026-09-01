import { prisma } from '@/server/db/client'
import crypto from 'crypto'

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

export async function getOrCreateReferral(userId: string) {
  const existing = await prisma.referral.findFirst({ where: { referrerId: userId } })
  if (existing) return existing

  let code: string
  let attempts = 0
  do {
    code = generateCode()
    attempts++
    if (attempts > 10) throw new Error('Could not generate unique referral code')
  } while (await prisma.referral.findUnique({ where: { code } }))

  return prisma.referral.create({
    data: { referrerId: userId, code },
  })
}

export async function applyReferral(code: string, refereeUserId: string) {
  const referral = await prisma.referral.findUnique({ where: { code } })
  if (!referral) throw new Error('REFERRAL_NOT_FOUND')
  if (referral.refereeUserId) throw new Error('REFERRAL_ALREADY_USED')
  if (referral.referrerId === refereeUserId) throw new Error('SELF_REFERRAL')

  return prisma.referral.update({
    where: { id: referral.id },
    data: { refereeUserId, rewardGranted: true },
  })
}

export async function getReferralStats(userId: string) {
  const referral = await prisma.referral.findFirst({ where: { referrerId: userId } })
  if (!referral) return { code: null, referredCount: 0, rewardGranted: false }

  const referredCount = await prisma.referral.count({
    where: { referrerId: userId, refereeUserId: { not: null } },
  })

  return { code: referral.code, referredCount, rewardGranted: referral.rewardGranted }
}

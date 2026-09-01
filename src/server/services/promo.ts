import { prisma } from '@/server/db/client'

export type PromoBannerInput = {
  title: string
  subtitle?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  imageUrl?: string | null
  isActive?: boolean
  sortOrder?: number
}

/** Активные баннеры для главной (публично). */
export function listActivePromoBanners() {
  return prisma.promoBanner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

/** Все баннеры (для админки). */
export function listAllPromoBanners() {
  return prisma.promoBanner.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

export function createPromoBanner(data: PromoBannerInput) {
  return prisma.promoBanner.create({
    data: {
      title: data.title,
      subtitle: data.subtitle ?? null,
      ctaLabel: data.ctaLabel ?? null,
      ctaUrl: data.ctaUrl ?? null,
      imageUrl: data.imageUrl ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  })
}

export function updatePromoBanner(id: string, data: Partial<PromoBannerInput>) {
  return prisma.promoBanner.update({ where: { id }, data })
}

export function deletePromoBanner(id: string) {
  return prisma.promoBanner.delete({ where: { id } })
}

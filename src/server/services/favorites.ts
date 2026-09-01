import { prisma } from '@/server/db/client'

export async function toggleFavorite(clientUserId: string, venueId: string) {
  const existing = await prisma.favorite.findUnique({
    where: { clientUserId_venueId: { clientUserId, venueId } },
  })

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } })
    return { favorited: false }
  }

  await prisma.favorite.create({ data: { clientUserId, venueId } })
  return { favorited: true }
}

export async function listFavorites(clientUserId: string) {
  return prisma.favorite.findMany({
    where: { clientUserId },
    include: {
      venue: {
        include: {
          category: true,
          resources: { select: { id: true, name: true, pricePerHour: true, price: true } },
          reviews: { select: { rating: true } },
        },
      },
    },
    orderBy: { id: 'desc' },
  })
}

export async function checkFavorite(clientUserId: string, venueId: string) {
  const fav = await prisma.favorite.findUnique({
    where: { clientUserId_venueId: { clientUserId, venueId } },
  })
  return { favorited: !!fav }
}

import type { MetadataRoute } from 'next'
import { prisma } from '@/server/db/client'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zabron.kz'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let venues: { id: string; createdAt: Date }[] = []
  let categories: { slug: string }[] = []
  try {
    venues = await prisma.venue.findMany({
      where: { contentStatus: 'PUBLISHED' },
      select: { id: true, createdAt: true },
    })
    categories = await prisma.category.findMany({ select: { slug: true } })
  } catch {
    // DB unavailable (e.g. during build) — return only static routes
  }

  const venueEntries: MetadataRoute.Sitemap = venues.map((v) => ({
    url: `${BASE_URL}/venues/${v.id}`,
    lastModified: v.createdAt,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  // Страницы категорий каталога (правка #40)
  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${BASE_URL}/venues?category=${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/venues`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    ...categoryEntries,
    ...venueEntries,
  ]
}

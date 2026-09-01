import { prisma } from '@/server/db/client'
import { ReviewStatus, BookingStatus } from '@prisma/client'

export class ReviewNotAllowedError extends Error {
  constructor() { super('REVIEW_NOT_ALLOWED') }
}

export async function createReview(params: {
  venueId: string
  bookingId?: string
  clientUserId: string
  rating: number
  text?: string
  photos?: string[]
}) {
  const { venueId, bookingId, clientUserId, rating, text, photos = [] } = params

  if (bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking || booking.clientUserId !== clientUserId || booking.status !== BookingStatus.COMPLETED) {
      throw new ReviewNotAllowedError()
    }
    const existing = await prisma.review.findUnique({ where: { bookingId } })
    if (existing) throw new Error('ALREADY_REVIEWED')
  } else {
    const completed = await prisma.booking.findFirst({
      where: { clientUserId, status: BookingStatus.COMPLETED, resource: { venueId } },
    })
    if (!completed) throw new ReviewNotAllowedError()
  }

  return prisma.review.create({
    data: { venueId, bookingId, clientUserId, rating, text, photos, status: ReviewStatus.PUBLISHED },
    include: { client: { select: { id: true, name: true, image: true } } },
  })
}

export async function listVenueReviews(venueId: string, params: { page?: number } = {}) {
  const { page = 1 } = params
  const take = 10
  const skip = (page - 1) * take

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where: { venueId, status: ReviewStatus.PUBLISHED },
      include: { client: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.review.count({ where: { venueId, status: ReviewStatus.PUBLISHED } }),
  ])

  return { items, total, page, pages: Math.ceil(total / take) }
}

export async function addMerchantResponse(reviewId: string, merchantUserId: string, response: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { venue: { include: { merchant: true } } },
  })
  if (!review) throw new Error('NOT_FOUND')
  if (review.venue.merchant.ownerUserId !== merchantUserId) throw new Error('FORBIDDEN')

  return prisma.review.update({ where: { id: reviewId }, data: { merchantResponse: response } })
}

export async function listClientReviews(clientUserId: string) {
  return prisma.review.findMany({
    where: { clientUserId },
    include: {
      client: { select: { id: true, name: true, image: true } },
      venue: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function hideReview(reviewId: string) {
  return prisma.review.update({ where: { id: reviewId }, data: { status: ReviewStatus.HIDDEN } })
}

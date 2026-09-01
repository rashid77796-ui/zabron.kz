import { z } from 'zod'

export const createBookingSchema = z.object({
  resourceId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  guests: z.number().int().positive().max(100),
  comment: z.string().max(500).optional(),
  customAnswers: z.record(z.unknown()).optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/).optional(),
})

export const bookingActionSchema = z.object({
  action: z.enum(['confirm', 'reject', 'cancel', 'no_show', 'complete']),
})

export const rescheduleBookingSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
})

export const walkInBookingSchema = z.object({
  resourceId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  guests: z.number().int().positive().max(100),
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/).optional(),
  comment: z.string().max(500).optional(),
})

export const guestBookingSchema = z.object({
  resourceId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  guests: z.number().int().positive().max(100),
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/),
  comment: z.string().max(500).optional(),
  customAnswers: z.record(z.unknown()).optional(),
})

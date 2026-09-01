import { z } from 'zod'

export const createVenueSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(2000),
  address: z.string().min(5).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().optional(),
  instagram: z.string().max(200).optional(),
  website: z.string().max(200).optional(),
  twogis: z.string().max(300).optional(),
  tiktok: z.string().max(200).optional(),
  listingOnly: z.boolean().optional(),
  photos: z.array(z.string().url()).max(10).optional(),
  bookingHorizonDays: z.coerce.number().int().min(1).max(365).optional(),   // глубина брони (правка #6)
  cancellationCutoffHours: z.coerce.number().int().min(0).max(720).optional(), // запрет отмены за N ч (правка #14)
  // Автоприём заявок (правка #53)
  autoRejectMinutesBeforeStart: z.coerce.number().int().min(0).max(1440).optional(),
  minLeadTimeMinutes: z.coerce.number().int().min(0).max(10080).optional(),
  autoRejectNoShowThreshold: z.coerce.number().int().min(1).max(100).nullish(),
  autoConfirmUnanswered: z.boolean().optional(),
})

export const updateVenueSchema = createVenueSchema.partial()

const VENUE_FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  description: 'Описание',
  address: 'Адрес',
  categoryId: 'Категория',
  lat: 'Широта',
  lng: 'Долгота',
  photos: 'Фотографии',
}

/** Превращает Zod-проблему в понятное русское сообщение для поля заведения. */
export function venueIssueToMessage(issue: z.ZodIssue, payload?: Record<string, unknown>): string {
  const field = String(issue.path[0])
  const label = VENUE_FIELD_LABELS[field] ?? field
  if (field === 'categoryId') return 'Выберите категорию'
  const value = payload?.[field]
  const current = typeof value === 'string' ? ` (сейчас ${value.length})` : ''
  switch (issue.code) {
    case 'too_small':
      return `Минимум ${issue.minimum} символов${current}`
    case 'too_big':
      return `Максимум ${issue.maximum} символов${current}`
    case 'invalid_type':
      return `${label}: обязательное поле`
    default:
      return issue.message
  }
}

/** Раскладывает массив Zod-проблем в карту «поле → первое сообщение». */
export function venueIssuesToFieldErrors(
  issues: z.ZodIssue[],
  payload?: Record<string, unknown>,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const field = String(issue.path[0])
    if (!fieldErrors[field]) fieldErrors[field] = venueIssueToMessage(issue, payload)
  }
  return fieldErrors
}

export const venueListQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  // Сортировка и фильтры каталога (правка #3)
  sort: z.enum(['rating', 'price_asc', 'price_desc', 'popular']).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
})

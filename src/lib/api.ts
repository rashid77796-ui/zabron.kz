/**
 * Typed API client — thin wrapper over fetch → Hono routes.
 * Uses relative URLs so it works in both SSR and client contexts.
 */

export type ApiCategory = {
  id: string
  slug: string
  nameRu: string
  nameKk: string
  nameEn: string
}

export type ApiResource = {
  id: string
  venueId?: string
  name: string
  capacity: number
  pricePerHour: number | null
  price: number | null
  bookingDeposit?: number | null // депозит/предоплата за бронь (правка #51)
  quantity: number
  allocationMode: string
  defaultDurationMin: number
  photos: string[]
  categoryId?: string | null
  category?: ApiCategory | null
  isBlocked?: boolean
}

export type ApiVenueHours = {
  id: string
  dayOfWeek: number
  openTime: string
  closeTime: string
}

export type ApiReview = {
  id: string
  rating: number
  text: string | null
  createdAt: string
  client: { id: string; name: string; image: string | null }
}

export type ApiVenue = {
  id: string
  name: string
  description: string
  address: string
  lat: number
  lng: number
  phone: string | null
  instagram?: string | null
  website?: string | null
  twogis?: string | null
  tiktok?: string | null
  listingOnly?: boolean
  photos: string[]
  contentStatus: string
  category: ApiCategory
  resources: ApiResource[]
  hours: ApiVenueHours[]
  reviews: ApiReview[]
  avgRating: number | null
  reviewCount: number
  minPrice?: number | null // минимальная цена/час среди кабинок (правка #3)
  bookingHorizonDays?: number       // глубина брони в днях (правка #6)
  cancellationCutoffHours?: number  // запрет отмены за N ч (правка #14)
  // Настройки автоприёма заявок (правка #53)
  autoRejectMinutesBeforeStart?: number
  minLeadTimeMinutes?: number
  autoRejectNoShowThreshold?: number | null
  autoConfirmUnanswered?: boolean
  isFeatured: boolean
  moderation?: { status: string; note: string | null; reviewedAt: string | null } | null
  // true, если у опубликованного заведения есть правка контента на модерации
  // (в каталоге пока прежняя версия, владельцу показывается новая) — правка #9
  hasPendingEdit?: boolean
}

export type ApiVenueMarker = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  category: { slug: string; nameRu: string }
}

export type ApiBooking = {
  id: string
  resourceId: string
  clientUserId: string | null
  guestName: string | null
  guestPhone: string | null
  startAt: string
  endAt: string
  guests: number
  comment: string | null
  status: string
  source: string
  checkInCode: string | null
  autoRejectAt: string
  confirmedAt: string | null
  cancelledAt: string | null
  createdAt: string
  resource: {
    id: string
    name: string
    bookingDeposit?: number | null
    venue: { id: string; name: string; address: string; category: ApiCategory }
  }
  client?: { id: string; name: string; email: string; phone: string | null; noShowCount: number } | null
}

export type ApiProfile = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  locale: string
  noShowCount: number
  image: string | null
}

export type ApiReviewFull = {
  id: string
  venueId: string
  bookingId: string | null
  clientUserId: string
  rating: number
  text: string | null
  photos: string[]
  merchantResponse: string | null
  status: string
  createdAt: string
  client: { id: string; name: string; image: string | null }
  venue?: { id: string; name: string }
}

export type ApiDiscount = {
  id: string
  venueId: string
  type: string
  percentage: number
  dayOfWeek: number | null
  startTime: string | null
  endTime: string | null
  validFrom: string | null
  validTo: string | null
}

export type ApiFavoriteVenue = {
  id: string
  name: string
  address: string
  photos: string[]
  contentStatus: string
  category: ApiCategory
  resources: { id: string; name: string; pricePerHour: number | null; price: number | null }[]
  reviews: { rating: number }[]
}

export type ApiFavorite = {
  id: string
  venueId: string
  venue: ApiFavoriteVenue
}

export type ApiModerationRequest = {
  id: string
  entityType: string
  entityId: string
  proposedData: unknown
  status: string
  submittedBy: string
  reviewedBy: string | null
  reviewedAt: string | null
  note: string | null
  createdAt: string
  venue: {
    id: string
    name: string
    description: string
    address: string
    lat: number
    lng: number
    phone: string | null
    photos: string[]
    contentStatus: string
    category: ApiCategory
    resources: ApiResource[]
    hours: ApiVenueHours[]
    merchant: { owner: { id: string; name: string; email: string; phone: string | null; createdAt: string } }
  } | null
  // Живой контент до слияния — для diff «было → стало» (правка #23)
  currentContent: { name: string; description: string; photos: string[] } | null
}

export type ApiMyModerationRequest = {
  id: string
  entityId: string
  status: string
  note: string | null
  createdAt: string
  reviewedAt: string | null
  venueName: string | null
}

export type ApiBlackout = {
  id: string
  resourceId: string
  startAt: string
  endAt: string
  reason: string | null
}

export type ApiWaitlistEntry = {
  id: string
  resourceId: string
  desiredStart: string
  status: string
  createdAt: string
  resource: {
    id: string
    name: string
    venue: { id: string; name: string; address: string; category: ApiCategory }
  }
}

export type ApiMerchantAdmin = {
  id: string
  status: string
  dealAmount: number | null
  dealCurrency: string | null
  dealPlan: string | null
  activatedAt: string | null
  expiresAt: string | null
  featuredUntil: string | null
  createdAt: string
  owner: { id: string; name: string; email: string; createdAt: string }
  venues: { id: string; name: string; contentStatus: string }[]
}

export type ApiUserAdmin = {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  merchant: { id: string; status: string } | null
}

export type ApiPlatformMetrics = {
  merchants: { PENDING: number; ACTIVE: number; SUSPENDED: number }
  userCount: number
  bookingsToday: number
  revenueThisMonth: number
}

// Промо-баннер главной (управляется из админки)
export type ApiPromoBanner = {
  id: string
  title: string
  subtitle: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  imageUrl: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export type PromoBannerPayload = {
  title: string
  subtitle?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  imageUrl?: string | null
  isActive?: boolean
  sortOrder?: number
}

export type ApiAuditLog = {
  id: string
  actorUserId: string | null
  action: string
  entityType: string
  entityId: string
  metadata: unknown
  createdAt: string
  // Автор действия (правка #26); null — системное действие
  actor: { id: string; name: string; email: string; role: string } | null
}

export type ApiNotification = {
  id: string
  type: string
  channel: string
  payload: { bookingId?: string; [key: string]: unknown }
  sentAt: string | null
  readAt: string | null // серверная отметка «прочитано» (правка #31)
  createdAt: string
}

export type ApiReferralStats = {
  code: string | null
  referredCount: number
  rewardGranted: boolean
}

export type ApiStaffMember = {
  id: string
  merchantId: string
  userId: string
  permissions: string[]
  user: { id: string; name: string; email: string; role: string }
}

export type ApiVenueQuestion = {
  id: string
  venueId: string
  text: string
  fieldType: string
  options: string[]
  isRequired: boolean
  sortOrder: number
}

export type ApiAnalytics = {
  period: { from: string; to: string }
  total: number
  confirmed: number
  completed: number
  noShows: number
  rejected: number
  cancelled: number
  byStatus: Record<string, number>
  revenue: number
  conversionRate: number
  noShowRate: number
  peakHours: { hour: number; label: string; count: number }[]
  bookingsByDay: { date: string; count: number }[]
}

// Аналитика всей платформы для админа (правка #25)
export type ApiPlatformAnalytics = {
  period: { from: string; to: string }
  total: number
  confirmed: number
  completed: number
  noShows: number
  rejected: number
  cancelled: number
  byStatus: Record<string, number>
  revenue: number
  conversionRate: number
  noShowRate: number
  byDay: { date: string; count: number; revenue: number }[]
  topByBookings: { id: string; name: string; count: number; revenue: number }[]
  topByRevenue: { id: string; name: string; count: number; revenue: number }[]
  totals: { users: number; merchants: number; venues: number }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    const raw = err?.error
    const issues = raw && typeof raw === 'object' ? raw.issues : undefined
    const message =
      typeof raw === 'string' ? raw
      : issues?.[0]?.message ? issues[0].message
      : err?.message ?? 'API_ERROR'
    throw Object.assign(new Error(message), { status: res.status, issues })
  }
  return res.json() as Promise<T>
}

export const api = {
  categories: {
    list: () => apiFetch<ApiCategory[]>('/categories'),
  },

  venues: {
    list: (params?: {
      category?: string; search?: string; page?: number; perPage?: number
      sort?: 'rating' | 'price_asc' | 'price_desc' | 'popular'
      minPrice?: number; maxPrice?: number; minRating?: number
    }) => {
      const q = new URLSearchParams()
      if (params?.category) q.set('category', params.category)
      if (params?.search) q.set('search', params.search)
      if (params?.page) q.set('page', String(params.page))
      if (params?.perPage) q.set('perPage', String(params.perPage))
      if (params?.sort) q.set('sort', params.sort)
      if (params?.minPrice != null) q.set('minPrice', String(params.minPrice))
      if (params?.maxPrice != null) q.set('maxPrice', String(params.maxPrice))
      if (params?.minRating != null) q.set('minRating', String(params.minRating))
      return apiFetch<{ items: ApiVenue[]; total: number; page: number; perPage: number }>(
        `/venues?${q}`
      )
    },
    get: (id: string) => apiFetch<ApiVenue>(`/venues/${id}`),
    markers: (params?: { category?: string; search?: string }) => {
      const q = new URLSearchParams()
      if (params?.category) q.set('category', params.category)
      if (params?.search) q.set('search', params.search)
      return apiFetch<ApiVenueMarker[]>(`/venues/markers?${q}`)
    },
    freeToday: () => apiFetch<ApiVenue[]>('/venues/free-today'),
    availability: (id: string, date: string) =>
      apiFetch<unknown[]>(`/venues/${id}/availability?date=${date}`),
    myVenues: () => apiFetch<ApiVenue[]>('/venues/my/venues'),
    create: (data: unknown) => apiFetch<ApiVenue>('/venues', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      apiFetch<ApiVenue>(`/venues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  bookings: {
    create: (data: {
      resourceId: string
      startAt: string
      endAt: string
      guests: number
      comment?: string
      customAnswers?: Record<string, unknown>
      phone?: string
    }) => apiFetch<ApiBooking>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
    createGuest: (data: {
      resourceId: string
      startAt: string
      endAt: string
      guests: number
      guestName: string
      guestPhone: string
      comment?: string
      customAnswers?: Record<string, unknown>
    }) => apiFetch<ApiBooking>('/bookings/guest', { method: 'POST', body: JSON.stringify(data) }),
    myBookings: (status?: string) =>
      apiFetch<ApiBooking[]>(`/bookings/my${status ? `?status=${status}` : ''}`),
    merchantBookings: (params?: { status?: string; venueId?: string; date?: string }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.venueId) q.set('venueId', params.venueId)
      if (params?.date) q.set('date', params.date)
      return apiFetch<ApiBooking[]>(`/bookings/merchant?${q}`)
    },
    action: (id: string, action: 'confirm' | 'reject' | 'cancel' | 'no_show' | 'complete') =>
      apiFetch<ApiBooking>(`/bookings/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    checkIn: (code: string) =>
      apiFetch<ApiBooking>('/bookings/checkin', { method: 'POST', body: JSON.stringify({ code }) }),
    reschedule: (id: string, data: { startAt: string; endAt: string }) =>
      apiFetch<ApiBooking>(`/bookings/${id}/reschedule`, { method: 'POST', body: JSON.stringify(data) }),
    suggest: (params: { resourceId: string; startAt: string; endAt: string }) => {
      const q = new URLSearchParams(params)
      return apiFetch<Array<{ startAt: string; endAt: string }>>(`/bookings/suggest?${q}`)
    },
    walkIn: (data: { resourceId: string; startAt: string; endAt: string; guests: number; guestName: string; guestPhone?: string; comment?: string }) =>
      apiFetch<ApiBooking>('/bookings/walkin', { method: 'POST', body: JSON.stringify(data) }),
  },

  profile: {
    get: () => apiFetch<ApiProfile>('/profile'),
    update: (data: { name?: string; phone?: string }) =>
      apiFetch<ApiProfile>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),
    export: async () => {
      const res = await fetch('/api/profile/export', { credentials: 'include' })
      if (!res.ok) throw new Error('EXPORT_FAILED')
      return res.blob()
    },
    delete: () => apiFetch<{ ok: boolean }>('/profile', { method: 'DELETE' }),
  },

  reviews: {
    list: (venueId: string, page?: number) => {
      const q = new URLSearchParams({ venueId })
      if (page) q.set('page', String(page))
      return apiFetch<{ items: ApiReviewFull[]; total: number; page: number; pages: number }>(`/reviews?${q}`)
    },
    myReviews: () => apiFetch<ApiReviewFull[]>('/reviews/my'),
    create: (data: { venueId: string; bookingId?: string; rating: number; text?: string; photos?: string[] }) =>
      apiFetch<ApiReviewFull>('/reviews', { method: 'POST', body: JSON.stringify(data) }),
    addResponse: (id: string, response: string) =>
      apiFetch<ApiReviewFull>(`/reviews/${id}/response`, { method: 'PATCH', body: JSON.stringify({ response }) }),
    hide: (id: string) =>
      apiFetch<{ ok: boolean }>(`/reviews/${id}`, { method: 'DELETE' }),
  },

  favorites: {
    list: () => apiFetch<ApiFavorite[]>('/favorites'),
    toggle: (venueId: string) =>
      apiFetch<{ favorited: boolean }>(`/favorites/${venueId}`, { method: 'POST' }),
    check: (venueId: string) =>
      apiFetch<{ favorited: boolean }>(`/favorites/${venueId}/check`),
  },

  discounts: {
    list: (venueId: string) =>
      apiFetch<ApiDiscount[]>(`/discounts?venueId=${venueId}`),
    create: (data: {
      venueId: string
      type: string
      percentage: number
      dayOfWeek?: number
      startTime?: string
      endTime?: string
      validFrom?: string
      validTo?: string
    }) => apiFetch<ApiDiscount>('/discounts', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/discounts/${id}`, { method: 'DELETE' }),
  },

  moderation: {
    list: (params?: { status?: string; page?: number }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.page) q.set('page', String(params.page))
      return apiFetch<{ items: ApiModerationRequest[]; total: number; page: number; pages: number }>(`/moderation?${q}`)
    },
    myRequests: () =>
      apiFetch<{ items: ApiMyModerationRequest[] }>('/moderation/my'),
    submitVenue: (venueId: string) =>
      apiFetch<unknown>(`/moderation/venues/${venueId}/submit`, { method: 'POST' }),
    approve: (id: string) =>
      apiFetch<unknown>(`/moderation/${id}/approve`, { method: 'POST' }),
    reject: (id: string, note: string) =>
      apiFetch<unknown>(`/moderation/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    revise: (id: string, note: string) =>
      apiFetch<unknown>(`/moderation/${id}/revise`, { method: 'POST', body: JSON.stringify({ note }) }),
  },

  analytics: {
    merchant: (params?: { from?: string; to?: string; venueId?: string }) => {
      const q = new URLSearchParams()
      if (params?.from) q.set('from', params.from)
      if (params?.to) q.set('to', params.to)
      if (params?.venueId) q.set('venueId', params.venueId)
      return apiFetch<ApiAnalytics>(`/analytics/merchant?${q}`)
    },
    platform: (params?: { from?: string; to?: string }) => {
      const q = new URLSearchParams()
      if (params?.from) q.set('from', params.from)
      if (params?.to) q.set('to', params.to)
      return apiFetch<ApiPlatformAnalytics>(`/analytics/platform?${q}`)
    },
  },

  resources: {
    create: (data: {
      venueId: string
      name: string
      capacity: number
      quantity?: number
      allocationMode?: string
      pricePerHour?: number
      price?: number
      bookingDeposit?: number | null
      defaultDurationMin?: number
      photos?: string[]
      categoryId?: string | null
    }) => apiFetch<ApiResource>('/resources', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{
      name: string
      capacity: number
      quantity: number
      pricePerHour: number | null
      price: number | null
      bookingDeposit: number | null
      defaultDurationMin: number
      photos: string[]
      isBlocked: boolean
      categoryId: string | null
    }>) => apiFetch<ApiResource>(`/resources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<{ ok: boolean }>(`/resources/${id}`, { method: 'DELETE' }),
    getHours: (venueId: string) => apiFetch<ApiVenueHours[]>(`/resources/hours?venueId=${venueId}`),
    setHours: (venueId: string, hours: { dayOfWeek: number; openTime: string; closeTime: string }[]) =>
      apiFetch<{ ok: boolean }>('/resources/hours', { method: 'PUT', body: JSON.stringify({ venueId, hours }) }),
    getBlackouts: (resourceId: string) => apiFetch<ApiBlackout[]>(`/resources/blackouts?resourceId=${resourceId}`),
    createBlackout: (data: { resourceId: string; startAt: string; endAt: string; reason?: string }) =>
      apiFetch<ApiBlackout>('/resources/blackouts', { method: 'POST', body: JSON.stringify(data) }),
    deleteBlackout: (id: string) => apiFetch<{ ok: boolean }>(`/resources/blackouts/${id}`, { method: 'DELETE' }),
  },

  waitlist: {
    list: () => apiFetch<ApiWaitlistEntry[]>('/waitlist'),
    join: (resourceId: string, desiredStart: string) =>
      apiFetch<ApiWaitlistEntry>('/waitlist', { method: 'POST', body: JSON.stringify({ resourceId, desiredStart }) }),
    leave: (id: string) => apiFetch<{ ok: boolean }>(`/waitlist/${id}`, { method: 'DELETE' }),
  },

  telegram: {
    getLink: () => apiFetch<{ linked: boolean; url: string | null }>('/telegram/link'),
  },

  notifications: {
    list: () => apiFetch<ApiNotification[]>('/notifications'),
    unreadCount: () => apiFetch<{ count: number }>('/notifications/unread-count'),
    markAllRead: () => apiFetch<{ ok: boolean }>('/notifications/read', { method: 'POST' }),
  },

  referrals: {
    my: () => apiFetch<ApiReferralStats>('/referrals/my'),
    apply: (code: string) =>
      apiFetch<{ id: string; code: string }>('/referrals/apply', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
  },

  promoBanners: {
    list: () => apiFetch<ApiPromoBanner[]>('/promo-banners'),
    listAll: () => apiFetch<ApiPromoBanner[]>('/promo-banners/all'),
    create: (data: PromoBannerPayload) =>
      apiFetch<ApiPromoBanner>('/promo-banners', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<PromoBannerPayload>) =>
      apiFetch<ApiPromoBanner>(`/promo-banners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/promo-banners/${id}`, { method: 'DELETE' }),
  },

  staff: {
    list: (merchantId?: string) => {
      const q = merchantId ? `?merchantId=${merchantId}` : ''
      return apiFetch<ApiStaffMember[]>(`/staff${q}`)
    },
    add: (email: string, permissions?: string[]) =>
      apiFetch<ApiStaffMember>('/staff', {
        method: 'POST',
        body: JSON.stringify({ email, permissions: permissions ?? [] }),
      }),
    remove: (staffId: string) =>
      apiFetch<{ ok: boolean }>(`/staff/${staffId}`, { method: 'DELETE' }),
  },

  admin: {
    metrics: () => apiFetch<ApiPlatformMetrics>('/admin/metrics'),
    merchants: (params?: { status?: string; page?: number; perPage?: number }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.page) q.set('page', String(params.page))
      if (params?.perPage) q.set('perPage', String(params.perPage))
      return apiFetch<{ items: ApiMerchantAdmin[]; total: number; page: number; pages: number }>(`/admin/merchants?${q}`)
    },
    activateMerchant: (id: string, deal?: { dealAmount?: number; dealPlan?: string; expiresAt?: string }) =>
      apiFetch<ApiMerchantAdmin>(`/admin/merchants/${id}/activate`, {
        method: 'POST',
        body: JSON.stringify(deal ?? {}),
      }),
    suspendMerchant: (id: string, reason?: string) =>
      apiFetch<ApiMerchantAdmin>(`/admin/merchants/${id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    setFeatured: (id: string, featuredUntil: string | null) =>
      apiFetch<unknown>(`/admin/merchants/${id}/feature`, {
        method: 'POST',
        body: JSON.stringify({ featuredUntil }),
      }),
    users: (params?: { page?: number; search?: string; role?: string }) => {
      const q = new URLSearchParams()
      if (params?.page) q.set('page', String(params.page))
      if (params?.search) q.set('search', params.search)
      if (params?.role) q.set('role', params.role)
      return apiFetch<{ items: ApiUserAdmin[]; total: number; page: number; pages: number }>(`/admin/users?${q}`)
    },
    setUserRole: (id: string, role: string) =>
      apiFetch<ApiUserAdmin>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    auditLogs: (params?: { page?: number; entityType?: string }) => {
      const q = new URLSearchParams()
      if (params?.page) q.set('page', String(params.page))
      if (params?.entityType) q.set('entityType', params.entityType)
      return apiFetch<{ items: ApiAuditLog[]; total: number; page: number; pages: number }>(`/admin/audit?${q}`)
    },
  },

  questions: {
    list: (venueId: string) =>
      apiFetch<ApiVenueQuestion[]>(`/venues/${venueId}/questions`),
    create: (venueId: string, data: { text: string; fieldType?: string; options?: string[]; isRequired?: boolean; sortOrder?: number }) =>
      apiFetch<ApiVenueQuestion>(`/venues/${venueId}/questions`, { method: 'POST', body: JSON.stringify(data) }),
    update: (venueId: string, id: string, data: { text?: string; fieldType?: string; options?: string[]; isRequired?: boolean; sortOrder?: number }) =>
      apiFetch<ApiVenueQuestion>(`/venues/${venueId}/questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (venueId: string, id: string) =>
      apiFetch<{ ok: boolean }>(`/venues/${venueId}/questions/${id}`, { method: 'DELETE' }),
  },
}

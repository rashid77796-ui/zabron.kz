'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { api } from '@/lib/api'
import { generateSlotsFromResource } from '@/lib/slots'
import { venueWallTimeToInstant, venueDateString } from '@/lib/timezone'
import { useAuth } from '@/lib/useAuth'
import type { TimeSlot } from '@/lib/types'
import BookingCalendar from '@/components/BookingCalendar'
import { CollapsibleMap } from '@/components/CollapsibleMap'
import { VenuePhotoCarousel } from '@/components/VenuePhotoCarousel'
import PhotoLightbox from '@/components/PhotoLightbox'
import LinkedText from '@/components/LinkedText'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  MapPin, Users, Banknote, Star, Phone, Flame, Heart,
  Tag, MessageSquare, RefreshCw, Share2,
} from 'lucide-react'
import type { ApiVenueQuestion } from '@/lib/api'

const BathhouseMap = dynamic(() => import('@/components/BathhouseMap'), { ssr: false })

// Строит ссылку из значения: полный URL — как есть; иначе строим по типу (правка #10).
function linkHref(kind: 'instagram' | 'tiktok' | 'url', value: string): string {
  const v = value.trim()
  if (/^https?:\/\//i.test(v)) return v
  if (kind === 'instagram') return `https://instagram.com/${v.replace(/^@/, '')}`
  if (kind === 'tiktok') return `https://tiktok.com/@${v.replace(/^@/, '')}`
  return `https://${v}`
}

type AvailabilityEntry = {
  resource: {
    id: string
    name: string
    capacity: number
    defaultDurationMin: number
    pricePerHour: number | null
    price: number | null
    photos: string[]
  }
  confirmedBookings: { startAt: string; endAt: string }[]
  blackouts: { startAt: string; endAt: string }[]
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star
            className={`h-6 w-6 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
          />
        </button>
      ))}
    </div>
  )
}

export default function VenueDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const rescheduleBookingId = searchParams.get('reschedule')
  const rescheduleResourceId = searchParams.get('resourceId')
  const defaultGuests = Number(searchParams.get('guests') ?? 1) || 1

  const [selectedResourceId, setSelectedResourceId] = useState<string>(rescheduleResourceId ?? '')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [guestCode, setGuestCode] = useState<string | null>(null) // код брони для гостя (#13)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})

  // Review form state
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewPage, setReviewPage] = useState(1)

  const { data: venue, isLoading } = useQuery({
    queryKey: ['venue', params.id],
    queryFn: () => api.venues.get(params.id),
    enabled: !!params.id,
  })

  const today = venueDateString() // дата в поясе заведения (правка #7)

  const { data: availability } = useQuery({
    queryKey: ['venue-availability', params.id, today],
    queryFn: () => api.venues.availability(params.id, today),
    enabled: !!venue,
  })

  const { data: discounts } = useQuery({
    queryKey: ['venue-discounts', params.id],
    queryFn: () => api.discounts.list(params.id),
    enabled: !!params.id,
  })

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['venue-reviews', params.id, reviewPage],
    queryFn: () => api.reviews.list(params.id, reviewPage),
    enabled: !!params.id,
  })

  // Открыть форму отзыва по ?review={bookingId} и проскроллить к отзывам (правка #13)
  useEffect(() => {
    if (searchParams.get('review')) {
      setShowReviewForm(true)
      const t = setTimeout(() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }), 300)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  const { data: favCheck } = useQuery({
    queryKey: ['fav-check', params.id],
    queryFn: () => api.favorites.check(params.id),
    enabled: !!user,
  })

  const { data: questions = [] } = useQuery<ApiVenueQuestion[]>({
    queryKey: ['venue-questions', params.id],
    queryFn: () => api.questions.list(params.id),
    enabled: !!params.id,
  })

  const currentResourceId = selectedResourceId || venue?.resources[0]?.id || ''
  const currentResource = venue?.resources.find(r => r.id === currentResourceId)

  const availabilityForResource = useMemo<AvailabilityEntry | undefined>(() => {
    if (!availability || !currentResourceId) return undefined
    return (availability as AvailabilityEntry[]).find(a => a.resource?.id === currentResourceId)
  }, [availability, currentResourceId])

  const slots = useMemo<TimeSlot[]>(() => {
    if (!venue || !currentResource || !availabilityForResource) return []
    return generateSlotsFromResource({
      resourceId: currentResource.id,
      venueId: venue.id,
      hours: venue.hours,
      slotDurationMin: currentResource.defaultDurationMin,
      confirmedBookings: availabilityForResource.confirmedBookings,
      blackouts: availabilityForResource.blackouts,
      daysAhead: venue.bookingHorizonDays, // совпадает с серверным окном (правка #6)
    })
  }, [venue, currentResource, availabilityForResource])

  // Active discount now
  const activeDiscount = useMemo(() => {
    if (!discounts?.length) return 0
    const now = new Date()
    const day = now.getDay()
    const timeStr = now.toTimeString().slice(0, 5)
    for (const d of discounts) {
      if (d.type === 'OFF_PEAK') {
        if (d.dayOfWeek !== null && d.dayOfWeek !== day) continue
        if (d.startTime && d.endTime) {
          if (timeStr >= d.startTime && timeStr < d.endTime) return d.percentage
        } else return d.percentage
      } else if (d.type === 'TIME_LIMITED' && d.validFrom && d.validTo) {
        const from = new Date(d.validFrom)
        const to = new Date(d.validTo)
        if (now >= from && now <= to) return d.percentage
      }
    }
    return 0
  }, [discounts])

  const bookMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.bookings.create>[0]) => api.bookings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-availability', params.id] })
    },
  })

  const rescheduleMutation = useMutation({
    mutationFn: (data: { startAt: string; endAt: string }) =>
      api.bookings.reschedule(rescheduleBookingId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-availability', params.id] })
      queryClient.invalidateQueries({ queryKey: ['my-bookings-all'] })
      router.push('/bookings')
    },
  })

  const favMutation = useMutation({
    mutationFn: () => api.favorites.toggle(params.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fav-check', params.id] })
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      toast.success(data.favorited ? 'Добавлено в избранное' : 'Удалено из избранного')
    },
  })

  const reviewMutation = useMutation({
    mutationFn: () => api.reviews.create({ venueId: params.id, rating: reviewRating, text: reviewText || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-reviews', params.id] })
      queryClient.invalidateQueries({ queryKey: ['venue', params.id] })
      setShowReviewForm(false)
      setReviewText('')
      setReviewRating(5)
      toast.success('Отзыв опубликован')
    },
    onError: (e: Error) => {
      if (e.message === 'REVIEW_NOT_ALLOWED') {
        toast.error('Отзыв только после завершённого бронирования')
      } else if (e.message === 'ALREADY_REVIEWED') {
        toast.error('Вы уже оставили отзыв по этому бронированию')
      } else {
        toast.error('Ошибка', { description: e.message })
      }
    },
  })

  const handleBook = async (
    slot: TimeSlot,
    guests: number,
    endTime?: string,
    comment?: string,
    guestName?: string,
    guestPhone?: string,
  ) => {
    const finalEndTime = endTime || slot.endTime
    // Время интерпретируем в поясе заведения (Астана), а не браузера (правка #7).
    const startDt = venueWallTimeToInstant(slot.date, slot.startTime)
    const endDt = venueWallTimeToInstant(slot.date, finalEndTime)
    // Переход через полночь (напр. 20:00→00:00 у круглосуточного): конец не позже
    // начала — значит это следующий день (баг #8).
    if (endDt <= startDt) endDt.setDate(endDt.getDate() + 1)
    const startAt = startDt.toISOString()
    const endAt = endDt.toISOString()

    try {
      if (!user) {
        const created = await api.bookings.createGuest({
          resourceId: slot.cabinId,
          startAt,
          endAt,
          guests,
          guestName: guestName!,
          guestPhone: guestPhone!,
          comment,
          customAnswers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
        })
        setGuestCode(created.checkInCode) // показываем гостю код брони (#13)
        toast.success('Заявка отправлена!', {
          description: `${currentResource?.name}: ${slot.date}, ${slot.startTime}–${finalEndTime}, ${guests} чел.`,
        })
      } else if (rescheduleBookingId) {
        await rescheduleMutation.mutateAsync({ startAt, endAt })
        toast.success('Бронь перенесена!', {
          description: `${currentResource?.name}: ${slot.date}, ${slot.startTime}–${finalEndTime}`,
        })
      } else {
        await bookMutation.mutateAsync({ resourceId: slot.cabinId, startAt, endAt, guests, comment, customAnswers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined, phone: guestPhone || undefined })
        toast.success('Заявка отправлена!', {
          description: `${currentResource?.name}: ${slot.date}, ${slot.startTime}–${finalEndTime}, ${guests} чел.`,
        })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN'
      if (msg === 'BOOKING_LIMIT') {
        toast.error('Лимит заявок', { description: 'У вас уже 3 активных заявки.' })
      } else if (msg === 'TOO_LATE_TO_BOOK') {
        toast.error('Слишком поздно для брони', { description: 'Заведение принимает брони заранее — выберите время подальше.' })
      } else if (msg === 'TOO_MANY_NO_SHOWS') {
        toast.error('Бронь недоступна', { description: 'Слишком много неявок. Обратитесь в заведение напрямую.' })
      } else if (msg === 'SLOT_CONFLICT') {
        const suggestions = await api.bookings.suggest({
          resourceId: slot.cabinId,
          startAt,
          endAt,
        }).catch(() => [])
        const hint = suggestions.length > 0
          ? 'Свободно: ' + suggestions.map(s =>
              new Date(s.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            ).join(', ')
          : 'Попробуйте другое время.'
        toast.error('Слот занят', { description: hint })
      } else {
        toast.error('Ошибка', { description: 'Попробуйте позже или выберите другое время.' })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

  if (!venue) {
    return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Заведение не найдено</div>
  }

  const bathhouseForMap = {
    id: venue.id,
    ownerId: '',
    name: venue.name,
    address: venue.address,
    description: venue.description,
    photos: venue.photos,
    lat: venue.lat,
    lng: venue.lng,
    phone: venue.phone ?? undefined,
  }

  const reviews = reviewsData?.items ?? []

  return (
    <div className="container mx-auto px-4 py-8">
      {guestCode && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border-2 border-green-400 bg-green-50 p-4">
          <div>
            <p className="font-semibold text-green-900">✅ Заявка отправлена! Ваш код брони:</p>
            <p className="mt-1 text-3xl font-bold tracking-[0.2em] text-green-700">{guestCode}</p>
            <p className="mt-1 text-xs text-green-800">Сохраните код и назовите его в заведении при визите. Бронь подтвердит заведение.</p>
          </div>
          <button onClick={() => setGuestCode(null)} className="shrink-0 text-green-700 hover:text-green-900" aria-label="Закрыть">✕</button>
        </div>
      )}
      {rescheduleBookingId && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2 text-sm text-blue-800">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Выберите новое время — бронь будет перенесена автоматически</span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => router.back()}>
            Отмена
          </Button>
        </div>
      )}
      {/* Photos */}
      <div className="mb-6">
        <div
          className="aspect-[21/9] max-h-72 overflow-hidden rounded-2xl mb-4 relative cursor-pointer bg-muted"
          onClick={() => { setLightboxIndex(0); setLightboxOpen(true) }}
        >
          {venue.photos[0] ? (
            <img src={venue.photos[0]} alt={venue.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Flame className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}
        </div>
        {venue.photos.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {venue.photos.slice(1).map((src, i) => (
              <div
                key={i}
                className="h-20 w-28 shrink-0 rounded-xl overflow-hidden border cursor-pointer"
                onClick={() => { setLightboxIndex(i + 1); setLightboxOpen(true) }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{venue.name}</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin className="h-4 w-4" />{venue.address}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{venue.category.nameRu}</Badge>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/venues/${venue.id}${currentResourceId ? `?resourceId=${currentResourceId}` : ''}`
                  navigator.clipboard.writeText(url)
                  toast.success('Ссылка скопирована')
                }}
                className="p-1.5 rounded-full hover:bg-accent transition-colors"
                title="Поделиться"
              >
                <Share2 className="h-5 w-5 text-muted-foreground" />
              </button>
              {user && (
                <button
                  onClick={() => favMutation.mutate()}
                  disabled={favMutation.isPending}
                  className="p-1.5 rounded-full hover:bg-accent transition-colors"
                  title={favCheck?.favorited ? 'Убрать из избранного' : 'Добавить в избранное'}
                >
                  <Heart
                    className={`h-5 w-5 ${favCheck?.favorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                  />
                </button>
              )}
            </div>
            {venue.avgRating != null && (
              <div className="flex items-center gap-1 text-sm text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>{venue.avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground text-xs">({venue.reviewCount})</span>
              </div>
            )}
            {activeDiscount > 0 && (
              <Badge className="bg-green-600 text-white gap-1">
                <Tag className="h-3 w-3" />–{activeDiscount}% сейчас
              </Badge>
            )}
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed mt-3">
          <LinkedText text={venue.description} />
        </p>

        {venue.phone && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-sm">
            <a href={`tel:${venue.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
              <Phone className="h-3.5 w-3.5" />{venue.phone}
            </a>
          </div>
        )}

        {(venue.instagram || venue.website || venue.twogis || venue.tiktok) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-sm">
            {venue.instagram && <a href={linkHref('instagram', venue.instagram)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">Instagram</a>}
            {venue.website && <a href={linkHref('url', venue.website)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">Сайт</a>}
            {venue.twogis && <a href={linkHref('url', venue.twogis)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">2ГИС</a>}
            {venue.tiktok && <a href={linkHref('tiktok', venue.tiktok)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">TikTok</a>}
          </div>
        )}

        {venue.lat && venue.lng && (
          <div className="mt-4">
            <CollapsibleMap label="Показать на карте" hideLabel="Скрыть карту">
              <BathhouseMap bathhouses={[bathhouseForMap]} selectedId={venue.id} />
            </CollapsibleMap>
          </div>
        )}
      </div>

      {/* Resources */}
      {venue.listingOnly ? (
        <div className="my-8 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center">
          <p className="font-semibold text-amber-900 mb-1">Это заведение ещё не подключено к Zabron</p>
          <p className="text-sm text-amber-800">Онлайн-бронирование здесь пока недоступно. Хотите бронировать тут онлайн? Попросите заведение подключиться к Zabron!</p>
        </div>
      ) : venue.resources.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Нет доступных ресурсов для бронирования</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4">Выберите ресурс</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {venue.resources.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedResourceId(r.id)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  currentResourceId === r.id ? 'ring-2 ring-primary border-primary bg-accent/50' : 'hover:border-primary/50'
                }`}
              >
                {r.photos.length > 0 && (
                  <div className="group aspect-[16/10] overflow-hidden rounded-xl mb-3">
                    <VenuePhotoCarousel photos={r.photos} alt={r.name} />
                  </div>
                )}
                <h3 className="font-semibold">{r.name}</h3>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />до {r.capacity} чел.
                  </span>
                  <div className="text-right">
                    {(r.pricePerHour || r.price) && (
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        <Banknote className="h-4 w-4" />
                        {r.pricePerHour
                          ? activeDiscount > 0
                            ? <><s className="text-muted-foreground text-xs">{r.pricePerHour.toLocaleString()}</s> {Math.round(r.pricePerHour * (1 - activeDiscount / 100)).toLocaleString()} ₸/ч</>
                            : `${r.pricePerHour.toLocaleString()} ₸/ч`
                          : `${r.price?.toLocaleString()} ₸`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Сеанс {r.defaultDurationMin} мин.</div>
              </button>
            ))}
          </div>

          {currentResource && (
            <div>
              <h2 className="mb-4 text-xl font-semibold">
                Календарь бронирования — {currentResource.name}
              </h2>
              {questions.length > 0 && (
                <div className="mb-6 rounded-xl border bg-muted/30 p-4 space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">Дополнительные вопросы от заведения</p>
                  {questions.map(q => (
                    <div key={q.id} className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {q.text}
                        {q.isRequired && <span className="text-destructive ml-1">*</span>}
                      </label>
                      {q.fieldType === 'select' && q.options.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {q.options.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setCustomAnswers(p => ({ ...p, [q.id]: opt }))}
                              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                                customAnswers[q.id] === opt
                                  ? 'border-primary bg-primary/10 text-primary font-medium'
                                  : 'hover:bg-accent'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          placeholder="Ваш ответ..."
                          value={customAnswers[q.id] ?? ''}
                          onChange={e => setCustomAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <BookingCalendar
                slots={slots}
                maxGuests={currentResource.capacity}
                onBook={handleBook}
                requireGuestInfo={!user}
                defaultGuests={defaultGuests}
                userPhone={(user as { phone?: string | null } | null)?.phone ?? null}
                pricePerHour={currentResource.pricePerHour}
                flatPrice={currentResource.price}
                discountPercent={activeDiscount}
                bookingDeposit={currentResource.bookingDeposit}
              />
            </div>
          )}
        </>
      )}

      {/* Reviews */}
      <section id="reviews" className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Отзывы{reviewsData?.total ? ` (${reviewsData.total})` : ''}
          </h2>
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReviewForm(v => !v)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Написать отзыв
            </Button>
          )}
        </div>

        {showReviewForm && (
          <div className="mb-6 rounded-xl border p-4 space-y-3">
            <div>
              <p className="text-sm font-medium mb-1.5">Оценка</p>
              <StarRating value={reviewRating} onChange={setReviewRating} />
            </div>
            <Textarea
              placeholder="Расскажите о вашем визите (необязательно)"
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => reviewMutation.mutate()}
                disabled={reviewMutation.isPending}
              >
                Опубликовать отзыв
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowReviewForm(false); setReviewText(''); setReviewRating(5) }}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {reviewsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">Отзывов пока нет. Будьте первым!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {r.client.image ? (
                      <img src={r.client.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {r.client.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm leading-tight">{r.client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-current' : 'opacity-20'}`} />
                    ))}
                  </div>
                </div>
                {r.text && <p className="text-sm text-foreground/80 leading-relaxed">{r.text}</p>}
                {r.photos.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                    {r.photos.map((src, i) => (
                      <img key={i} src={src} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover border" />
                    ))}
                  </div>
                )}
                {r.merchantResponse && (
                  <div className="mt-3 pl-3 border-l-2 border-primary/30">
                    <p className="text-xs font-medium text-primary mb-0.5">Ответ заведения</p>
                    <p className="text-sm text-muted-foreground">{r.merchantResponse}</p>
                  </div>
                )}
              </div>
            ))}

            {reviewsData && reviewsData.pages > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                {Array.from({ length: reviewsData.pages }, (_, i) => i + 1).map(p => (
                  <Button
                    key={p}
                    variant={p === reviewPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReviewPage(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {venue.photos.length > 0 && (
        <PhotoLightbox
          photos={venue.photos}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </div>
  )
}

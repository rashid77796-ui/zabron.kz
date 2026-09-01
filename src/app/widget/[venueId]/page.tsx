'use client'

import { useMemo, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, type ApiVenue } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { generateSlotsFromResource } from '@/lib/slots'
import { venueWallTimeToInstant, venueDateString } from '@/lib/timezone'
import BookingCalendar from '@/components/BookingCalendar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MapPin, Star, Check } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { toast } from 'sonner'
import type { TimeSlot } from '@/lib/types'

type AvailabilityEntry = {
  resource: { id: string } | null
  confirmedBookings: { startAt: string; endAt: string }[]
  blackouts: { startAt: string; endAt: string }[]
}

// Локализация виджета по параметру ?lang= (правка #36). Виджет встраивают на разные
// сайты, поэтому строки самого виджета переведены здесь (внутренние строки календаря — #43).
type WidgetLang = 'ru' | 'kk' | 'en'
const WIDGET_STRINGS: Record<WidgetLang, {
  notFound: string; requestSentTitle: string; guestHint: string; ownerHint: string
  newBooking: string; resource: string; poweredBy: string; toastSent: string; error: string
}> = {
  ru: {
    notFound: 'Заведение не найдено',
    requestSentTitle: 'Заявка отправлена!',
    guestHint: 'Заведение подтвердит бронь и свяжется по телефону. Сохраните код и назовите его в заведении:',
    ownerHint: 'Владелец подтвердит в течение суток. Уведомление придёт на email.',
    newBooking: 'Новая бронь',
    resource: 'Ресурс',
    poweredBy: 'Работает на',
    toastSent: 'Заявка отправлена',
    error: 'Ошибка',
  },
  kk: {
    notFound: 'Мекеме табылмады',
    requestSentTitle: 'Өтінім жіберілді!',
    guestHint: 'Мекеме броньді растап, телефон арқылы хабарласады. Кодты сақтап, мекемеде айтыңыз:',
    ownerHint: 'Иесі тәулік ішінде растайды. Хабарлама email-ге келеді.',
    newBooking: 'Жаңа бронь',
    resource: 'Ресурс',
    poweredBy: 'Қуаттайды',
    toastSent: 'Өтінім жіберілді',
    error: 'Қате',
  },
  en: {
    notFound: 'Venue not found',
    requestSentTitle: 'Request sent!',
    guestHint: 'The venue will confirm and contact you by phone. Save the code and give it at the venue:',
    ownerHint: 'The owner will confirm within a day. A notification will be sent to your email.',
    newBooking: 'New booking',
    resource: 'Resource',
    poweredBy: 'Powered by',
    toastSent: 'Request sent',
    error: 'Error',
  },
}

export default function WidgetPage() {
  const params = useParams<{ venueId: string }>()
  const { user } = useAuth()
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [booked, setBooked] = useState(false)
  const [guestCode, setGuestCode] = useState<string | null>(null) // код брони гостю (#34)
  const [lang, setLang] = useState<WidgetLang>('ru') // язык виджета из ?lang= (#36)

  // Читаем ?lang= из URL без useSearchParams, чтобы не требовать Suspense-обёртку
  useEffect(() => {
    const l = new URLSearchParams(window.location.search).get('lang')
    if (l === 'kk' || l === 'en') setLang(l)
  }, [])
  const t = WIDGET_STRINGS[lang]

  const today = venueDateString() // дата в поясе заведения (правка #7)

  const { data: venue, isLoading } = useQuery<ApiVenue>({
    queryKey: ['venue', params.venueId],
    queryFn: () => api.venues.get(params.venueId),
  })

  useEffect(() => {
    if (venue?.resources.length && !selectedResourceId) {
      setSelectedResourceId(venue.resources[0].id)
    }
  }, [venue])

  const { data: availability } = useQuery({
    queryKey: ['availability', params.venueId, today],
    queryFn: () => api.venues.availability(params.venueId, today),
    enabled: !!venue,
  })

  const currentResource = venue?.resources.find(r => r.id === selectedResourceId)

  const availabilityForResource = useMemo(() => {
    if (!availability || !selectedResourceId) return undefined
    return (availability as AvailabilityEntry[]).find(a => a.resource?.id === selectedResourceId)
  }, [availability, selectedResourceId])

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

  const bookMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.bookings.create>[0]) => api.bookings.create(data),
    onSuccess: () => {
      setBooked(true)
      toast.success(t.toastSent)
    },
    onError: (e: Error) => toast.error(t.error, { description: e.message }),
  })

  const guestBookMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.bookings.createGuest>[0]) => api.bookings.createGuest(data),
    onSuccess: (data) => {
      setGuestCode(data.checkInCode)
      setBooked(true)
      toast.success(t.toastSent)
    },
    onError: (e: Error) => toast.error(t.error, { description: e.message }),
  })

  const handleBook = (slot: TimeSlot, guests: number, endTime?: string, comment?: string, guestName?: string, guestPhone?: string) => {
    // Момент времени в поясе заведения (Астана) + переход через полночь (#33/#7)
    const startDt = venueWallTimeToInstant(slot.date, slot.startTime)
    const endDt = venueWallTimeToInstant(slot.date, endTime ?? slot.endTime)
    if (endDt <= startDt) endDt.setDate(endDt.getDate() + 1)
    const startAt = startDt.toISOString()
    const endAt = endDt.toISOString()
    if (!user) {
      guestBookMutation.mutate({
        resourceId: slot.cabinId,
        startAt,
        endAt,
        guests,
        guestName: guestName!,
        guestPhone: guestPhone!,
        comment: comment || undefined,
      })
      return
    }
    bookMutation.mutate({ resourceId: slot.cabinId, startAt, endAt, guests, comment: comment || undefined })
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 min-h-screen bg-background">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>{t.notFound}</p>
      </div>
    )
  }

  if (booked) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{t.requestSentTitle}</h2>
          {guestCode ? (
            <>
              <p className="text-muted-foreground mt-1 text-sm">
                {t.guestHint}
              </p>
              <p className="mt-2 text-2xl font-bold tracking-[0.2em] text-green-700">{guestCode}</p>
            </>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">
              {t.ownerHint}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => { setBooked(false); setGuestCode(null) }}>
          {t.newBooking}
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Compact header */}
      <div className="border-b px-4 py-3 flex items-center">
        <Logo variant="wordmark" className="h-5 w-auto" />
      </div>

      <div className="p-4 space-y-4">
        {/* Venue info */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-bold leading-tight">{venue.name}</h1>
            {venue.avgRating && (
              <div className="flex items-center gap-1 text-sm text-amber-500 shrink-0">
                <Star className="h-3.5 w-3.5 fill-current" />
                {venue.avgRating.toFixed(1)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3" />
            {venue.address}
          </div>
          <Badge variant="secondary" className="mt-2 text-xs">{venue.category.nameRu}</Badge>
        </div>

        {/* Resource selector */}
        {venue.resources.length > 1 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">{t.resource}</p>
            <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Выберите ресурс" />
              </SelectTrigger>
              <SelectContent>
                {venue.resources.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Booking calendar */}
        {currentResource && (
          <BookingCalendar
            slots={slots}
            maxGuests={currentResource.capacity}
            onBook={handleBook}
            requireGuestInfo={!user}
            pricePerHour={currentResource.pricePerHour}
            flatPrice={currentResource.price}
            bookingDeposit={currentResource.bookingDeposit}
          />
        )}

        {/* Embed code info */}
        <p className="text-center text-xs text-muted-foreground pt-2 border-t">
          {t.poweredBy}{' '}
          <a href="/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
             Zabron
          </a>
        </p>
      </div>
    </div>
  )
}

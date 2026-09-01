'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { QRCodeDisplay } from '@/components/QRCodeDisplay'
import { Calendar, Users, Clock, X, QrCode, RefreshCw, Share2, RotateCcw, Star } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Ожидает', variant: 'secondary' },
  CONFIRMED: { label: 'Подтверждена', variant: 'default' },
  REJECTED: { label: 'Отклонена', variant: 'destructive' },
  AUTO_REJECTED: { label: 'Авто-отклонена', variant: 'destructive' },
  SLOT_TAKEN: { label: 'Место занято', variant: 'destructive' },
  CANCELLED: { label: 'Отменена', variant: 'outline' },
  NO_SHOW: { label: 'Неявка', variant: 'destructive' },
  COMPLETED: { label: 'Завершена', variant: 'default' },
}

function BookingsContent() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [qrBooking, setQrBooking] = useState<{ id: string; checkInCode: string; venueName: string } | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [user, authLoading, router])

  // Единый кэш-ключ с дашбордом, чтобы отмена на одной странице обновляла другую (правка #11)
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.bookings.myBookings(),
    enabled: !!user,
  })

  const { data: myReviews } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: api.reviews.myReviews,
    enabled: !!user,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.bookings.action(id, 'cancel'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
    onError: (e: Error) => {
      if (e.message === 'CANCEL_TOO_LATE') toast.error('Отмена невозможна', { description: 'Слишком поздно отменять эту бронь по правилам заведения' })
      else toast.error('Не удалось отменить бронь')
    },
  })

  // Есть ли уже отзыв по этой брони/заведению — скрыть кнопку «Оставить отзыв» (правка #13)
  const hasReviewFor = (b: { id: string; resource: { venue: { id: string } } }) =>
    (myReviews ?? []).some(r => r.bookingId === b.id || (r.bookingId == null && r.venueId === b.resource.venue.id))

  if (authLoading || !user) return null

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Мои бронирования</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : !bookings?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">Нет бронирований</p>
          <Link href="/venues">
            <Button variant="link" className="mt-2">Найти заведение</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const s = STATUS_LABELS[b.status] ?? { label: b.status, variant: 'secondary' as const }
            const start = new Date(b.startAt)
            const end = new Date(b.endAt)
            return (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link href={`/venues/${b.resource.venue.id}`} className="font-semibold hover:underline">
                          {b.resource.venue.name}
                        </Link>
                        <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{b.resource.name}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–{end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />{b.guests} чел.
                        </span>
                      </div>
                      {b.checkInCode && b.status === 'CONFIRMED' && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Код: </span>
                          <span className="font-mono font-bold text-xs">{b.checkInCode}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setQrBooking({ id: b.id, checkInCode: b.checkInCode!, venueName: b.resource.venue.name })}
                          >
                            <QrCode className="h-3 w-3 mr-1" /> QR
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Поделиться"
                        onClick={() => {
                          const url = `${window.location.origin}/venues/${b.resource.venue.id}?resourceId=${b.resource.id}`
                          navigator.clipboard.writeText(url)
                          toast.success('Ссылка скопирована')
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {b.status === 'COMPLETED' && !hasReviewFor(b) && (
                        <Link href={`/venues/${b.resource.venue.id}?review=${b.id}`}>
                          <Button variant="ghost" size="sm" title="Оставить отзыв">
                            <Star className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      {['COMPLETED', 'CANCELLED', 'REJECTED', 'AUTO_REJECTED', 'NO_SHOW', 'SLOT_TAKEN'].includes(b.status) && (
                        <Link href={`/venues/${b.resource.venue.id}?resourceId=${b.resource.id}&guests=${b.guests}`}>
                          <Button variant="ghost" size="sm" title="Повторить бронь">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                        <>
                          <Link href={`/venues/${b.resource.venue.id}?reschedule=${b.id}&resourceId=${b.resource.id}`}>
                            <Button variant="ghost" size="sm" title="Перенести">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </Link>
                          <ConfirmButton
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={cancelMutation.isPending}
                            triggerTitle="Отменить"
                            title="Отменить бронь?"
                            description="Это действие необратимо — бронь будет отменена."
                            confirmLabel="Отменить бронь"
                            cancelLabel="Назад"
                            onConfirm={() => cancelMutation.mutate(b.id)}
                          >
                            <X className="h-4 w-4" />
                          </ConfirmButton>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {qrBooking && (
        <Dialog open onOpenChange={() => setQrBooking(null)}>
          <DialogContent className="max-w-xs text-center">
            <DialogHeader>
              <DialogTitle>Чек-ин QR</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-2">{qrBooking.venueName}</p>
            <div className="flex justify-center">
              <QRCodeDisplay value={qrBooking.checkInCode} size={200} />
            </div>
            <p className="font-mono text-sm font-bold mt-2">{qrBooking.checkInCode}</p>
            <p className="text-xs text-muted-foreground">Покажите код на стойке ресепшена</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsContent />
    </Suspense>
  )
}

'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { api, type ApiBooking, type ApiVenue, type ApiDiscount, type ApiStaffMember, type ApiMyModerationRequest } from '@/lib/api'
import { venueWallTimeToInstant } from '@/lib/timezone'
import { useAuth } from '@/lib/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ChangePasswordCard } from '@/components/ChangePasswordCard'
import { AppearanceCard } from '@/components/AppearanceCard'
import { LogoutCard } from '@/components/LogoutCard'
import { PhoneActions } from '@/components/PhoneActions'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Check, X, Users, Clock, Calendar, MapPin, TrendingUp, Trash2, Plus, Settings, UserPlus, Code2, Copy, UserCheck, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

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

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// Короткий звуковой сигнал о новой заявке через WebAudio (без внешнего аудиофайла) — правка #15.
// Может быть заблокирован политикой автозапуска до взаимодействия с вкладкой; ошибки глушим.
function playNewBookingSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.36)
    osc.onended = () => ctx.close().catch(() => {})
  } catch {
    /* звук недоступен — не критично */
  }
}

function BookingRow({ booking, onAction }: {
  booking: ApiBooking
  onAction: (id: string, action: 'confirm' | 'reject' | 'no_show' | 'complete') => void
}) {
  const s = STATUS_LABELS[booking.status] ?? { label: booking.status, variant: 'secondary' as const }
  const start = new Date(booking.startAt)
  const end = new Date(booking.endAt)
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-sm">
                {booking.client?.name ?? booking.guestName ?? 'Гость'}
              </span>
              {!booking.client && booking.guestName && (
                <Badge variant="outline" className="text-xs">Без регистрации</Badge>
              )}
              <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
              {(booking.client?.noShowCount ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs gap-1">
                  ⚠ {booking.client!.noShowCount} неявки
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{booking.resource.venue.name} — {booking.resource.name}</p>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–{end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{booking.guests} чел.</span>
              {(booking.client?.phone ?? booking.guestPhone) && (
                <PhoneActions phone={(booking.client?.phone ?? booking.guestPhone)!} />
              )}
              {booking.resource.bookingDeposit != null && booking.resource.bookingDeposit > 0 && (
                <span className="flex items-center gap-1 font-medium text-amber-700">
                  Бронь: {booking.resource.bookingDeposit.toLocaleString()} ₸
                </span>
              )}
            </div>
            {booking.comment && (
              <p className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                💬 {booking.comment}
              </p>
            )}
          </div>
          {booking.status === 'PENDING' && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => onAction(booking.id, 'confirm')}><Check className="h-4 w-4" /></Button>
              <ConfirmButton
                size="sm"
                variant="destructive"
                triggerTitle="Отклонить бронь"
                title="Отклонить бронь?"
                description={`Бронь клиента «${booking.client?.name ?? booking.guestName ?? 'Гость'}» будет отклонена, клиент получит уведомление. Действие необратимо.`}
                confirmLabel="Отклонить"
                onConfirm={() => onAction(booking.id, 'reject')}
              >
                <X className="h-4 w-4" />
              </ConfirmButton>
            </div>
          )}
          {booking.status === 'CONFIRMED' && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => onAction(booking.id, 'complete')}>Готово</Button>
              <ConfirmButton
                size="sm"
                variant="ghost"
                className="text-destructive"
                title="Отметить неявку?"
                description="Клиенту будет засчитана неявка (увеличится счётчик неявок). Действие необратимо."
                confirmLabel="Неявка"
                onConfirm={() => onAction(booking.id, 'no_show')}
              >
                Неявка
              </ConfirmButton>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function VenueDiscounts({ venue }: { venue: ApiVenue }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ type: 'OFF_PEAK', percentage: 20, dayOfWeek: '', startTime: '', endTime: '' })
  const [showForm, setShowForm] = useState(false)

  const { data: discounts, isLoading } = useQuery({
    queryKey: ['discounts', venue.id],
    queryFn: () => api.discounts.list(venue.id),
  })

  const createMutation = useMutation({
    mutationFn: () => api.discounts.create({
      venueId: venue.id,
      type: form.type,
      percentage: Number(form.percentage),
      dayOfWeek: form.dayOfWeek !== '' ? Number(form.dayOfWeek) : undefined,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts', venue.id] })
      setShowForm(false)
      toast.success('Скидка добавлена')
    },
    onError: () => toast.error('Ошибка при добавлении скидки'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.discounts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts', venue.id] })
      toast.success('Скидка удалена')
    },
  })

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Скидки — {venue.name}</h4>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3 w-3 mr-1" />Добавить
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-3 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Тип</label>
              <select
                className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                <option value="OFF_PEAK">Непиковые часы</option>
                <option value="TIME_LIMITED">Ограниченный период</option>
                <option value="FIRST_VISIT">Первое посещение</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Скидка %</label>
              <Input
                type="number" min={1} max={90}
                value={form.percentage}
                onChange={e => setForm(f => ({ ...f, percentage: Number(e.target.value) }))}
                className="h-9 text-sm"
              />
            </div>
          </div>
          {form.type === 'OFF_PEAK' && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">День недели</label>
                <select
                  className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                  value={form.dayOfWeek}
                  onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}
                >
                  <option value="">Все дни</option>
                  {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Начало</label>
                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Конец</label>
                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Сохранить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-10 w-full rounded" />
      ) : !discounts?.length ? (
        <p className="text-xs text-muted-foreground">Скидок нет</p>
      ) : (
        <div className="space-y-2">
          {discounts.map((d: ApiDiscount) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">–{d.percentage}%</span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {d.type === 'OFF_PEAK' ? 'Непиковые' : d.type === 'TIME_LIMITED' ? 'Период' : 'Первый визит'}
                  {d.dayOfWeek !== null ? ` · ${DAY_LABELS[d.dayOfWeek ?? 0]}` : ''}
                  {d.startTime && d.endTime ? ` · ${d.startTime}–${d.endTime}` : ''}
                </span>
              </div>
              <ConfirmButton
                size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                disabled={deleteMutation.isPending}
                triggerTitle="Удалить скидку"
                title="Удалить скидку?"
                description="Скидка будет удалена. Это действие необратимо."
                confirmLabel="Удалить"
                onConfirm={() => deleteMutation.mutate(d.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ConfirmButton>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmbedCodeBlock({ venueId }: { venueId: string }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://zabron.kz'
  const src = `${origin}/widget/${venueId}`
  const code = `<iframe src="${src}" width="420" height="680" frameborder="0" style="border-radius:12px;border:1px solid #e5e7eb"></iframe>`

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mt-3 rounded-lg border bg-muted/40 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Код виджета — вставьте на сайт или в Instagram Bio</p>
      <div className="flex gap-2 items-start">
        <code className="flex-1 text-xs bg-background border rounded-md px-2 py-1.5 font-mono break-all">{code}</code>
        <Button size="sm" variant="outline" className="shrink-0 h-8 gap-1" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'OK' : 'Копировать'}
        </Button>
      </div>
    </div>
  )
}

const MODERATION_HISTORY: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'На проверке', cls: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Одобрено', cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Отклонено', cls: 'bg-red-100 text-red-800' },
  NEEDS_REVISION: { label: 'На доработке', cls: 'bg-orange-100 text-orange-800' },
}

function ModerationHistoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-moderation'],
    queryFn: () => api.moderation.myRequests(),
  })
  const items = data?.items ?? []

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>Вы ещё не отправляли заведения на модерацию</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Все ваши заявки на публикацию — от старых к новым.</p>
      {items.map(req => {
        const st = MODERATION_HISTORY[req.status] ?? { label: req.status, cls: 'bg-gray-100 text-gray-700' }
        return (
          <Card key={req.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link href={`/owner/venues/${req.entityId}`} className="font-medium hover:underline truncate">
                      {req.venueName ?? `Заведение #${req.entityId.slice(0, 8)}`}
                    </Link>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Отправлено {new Date(req.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                    {req.reviewedAt && ` · рассмотрено ${new Date(req.reviewedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`}
                  </p>
                </div>
              </div>
              {req.note && (
                <div className={`mt-2 rounded px-2.5 py-1.5 text-xs ${
                  req.status === 'NEEDS_REVISION' ? 'bg-orange-50 text-orange-800' : 'bg-destructive/10 text-destructive'
                }`}>
                  <span className="font-medium">Комментарий модератора: </span>{req.note}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function OwnerContent() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
    if (!authLoading && user && user.role !== 'merchant' && user.role !== 'super_admin') router.push('/')
  }, [user, authLoading, router])

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['merchant-bookings'],
    queryFn: () => api.bookings.merchantBookings(),
    enabled: !!user,
    refetchInterval: 10_000, // быстрый отклик на новые заявки (правка #15)
  })

  // Оперативное оповещение о новых заявках: звук + тост + desktop-уведомление (правка #15).
  // Разрешение на desktop-уведомления спрашиваем один раз (только если пользователь не отклонял).
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const prevPendingIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!bookings) return
    const currentPending = bookings.filter(b => b.status === 'PENDING').map(b => b.id)
    const prev = prevPendingIds.current
    if (prev) {
      const fresh = currentPending.filter(id => !prev.has(id))
      if (fresh.length > 0) {
        playNewBookingSound()
        toast.info(`Новых заявок: ${fresh.length}`, { description: 'Проверьте вкладку «Заявки»' })
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Zabron — новая заявка на бронь', {
              body: `Ожидает подтверждения: ${currentPending.length}`,
            })
          } catch { /* некоторые браузеры требуют ServiceWorkerRegistration.showNotification */ }
        }
      }
    }
    prevPendingIds.current = new Set(currentPending)
  }, [bookings])

  const { data: venues, isLoading: venuesLoading } = useQuery({
    queryKey: ['my-venues'],
    queryFn: api.venues.myVenues,
    enabled: !!user,
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics-merchant'],
    queryFn: () => api.analytics.merchant(),
    enabled: !!user,
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'reject' | 'no_show' | 'complete' }) =>
      api.bookings.action(id, action),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['merchant-bookings'] })
      const msgs = { confirm: 'Бронь подтверждена', reject: 'Бронь отклонена', no_show: 'Неявка', complete: 'Завершено' }
      toast.success(msgs[action])
    },
    onError: (e: Error) => {
      if (e.message === 'SLOT_CONFLICT') toast.error('Слот уже занят')
      else toast.error('Ошибка', { description: e.message })
    },
  })

  const submitMutation = useMutation({
    mutationFn: (venueId: string) => api.moderation.submitVenue(venueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-venues'] })
      toast.success('Заявка на публикацию отправлена')
    },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  const [embedOpenId, setEmbedOpenId] = useState<string | null>(null)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')                   // фильтр истории (#18)
  const [clientFilter, setClientFilter] = useState<string | null>(null)  // выбранный клиент (#5)
  const [walkInData, setWalkInData] = useState({
    resourceId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '12:00',
    guests: 1,
    guestName: '',
    guestPhone: '',
    comment: '',
  })

  const walkInMutation = useMutation({
    mutationFn: () => {
      // Время интерпретируем в поясе заведения (Астана), а не браузера (правка #7)
      const startDt = venueWallTimeToInstant(walkInData.date, walkInData.startTime)
      const endDt = venueWallTimeToInstant(walkInData.date, walkInData.endTime)
      // Ночная смена: если конец ≤ начала — перенос конца на следующий день (правка #18)
      if (endDt <= startDt) endDt.setDate(endDt.getDate() + 1)
      return api.bookings.walkIn({
        resourceId: walkInData.resourceId,
        startAt: startDt.toISOString(),
        endAt: endDt.toISOString(),
        guests: walkInData.guests,
        guestName: walkInData.guestName,
        guestPhone: walkInData.guestPhone || undefined,
        comment: walkInData.comment || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-bookings'] })
      toast.success('Walk-in бронь создана и подтверждена')
      setWalkInOpen(false)
      setWalkInData({ resourceId: '', date: new Date().toISOString().split('T')[0], startTime: '10:00', endTime: '12:00', guests: 1, guestName: '', guestPhone: '', comment: '' })
    },
    onError: (e: Error) => {
      if (e.message === 'SLOT_CONFLICT') toast.error('Слот занят', { description: 'Выберите другое время' })
      else toast.error('Ошибка', { description: e.message })
    },
  })

  // Валидация времени walk-in с учётом ночных смен (правка #18)
  let walkInTimeError: string | null = null
  if (walkInData.date && walkInData.startTime && walkInData.endTime) {
    if (walkInData.startTime === walkInData.endTime) {
      walkInTimeError = 'Начало и конец брони совпадают'
    } else {
      const start = venueWallTimeToInstant(walkInData.date, walkInData.startTime)
      const end = venueWallTimeToInstant(walkInData.date, walkInData.endTime)
      if (end <= start) end.setDate(end.getDate() + 1)
      const hours = (end.getTime() - start.getTime()) / 3_600_000
      if (hours > 24) walkInTimeError = 'Слишком большая длительность (более 24 ч)'
    }
  }

  if (authLoading || !user) return null

  const CLOSED_STATUSES = ['COMPLETED', 'NO_SHOW', 'REJECTED', 'AUTO_REJECTED', 'CANCELLED', 'SLOT_TAKEN']
  const pending = bookings?.filter(b => b.status === 'PENDING') ?? []
  const confirmed = bookings?.filter(b => b.status === 'CONFIRMED') ?? []
  const past = bookings?.filter(b => CLOSED_STATUSES.includes(b.status)) ?? []

  // Уникальные клиенты из броней (правки #3/#5/#16).
  // Приоритет ключа: стабильный client.id → guestPhone → имя (чтобы зарегистрированные
  // клиенты не дробились и не склеивались, а гости-однофамильцы без телефона не сливались).
  const clientKey = (b: ApiBooking) =>
    b.client?.id
      ? `id:${b.client.id}`
      : b.guestPhone
      ? `ph:${b.guestPhone}`
      : `name:${b.guestName ?? 'Гость'}`
  const clientsMap = new Map<string, { name: string; phone: string; count: number; last: number }>()
  for (const b of bookings ?? []) {
    const key = clientKey(b)
    const t = new Date(b.startAt).getTime()
    const name = b.client?.name ?? b.guestName ?? 'Гость'
    const phone = b.client?.phone ?? b.guestPhone ?? ''
    const ex = clientsMap.get(key)
    if (ex) {
      ex.count++
      if (t > ex.last) ex.last = t
      // Дополняем недостающие поля из более полной записи клиента в группе
      if ((!ex.phone || ex.name === 'Гость') && (phone || name !== 'Гость')) {
        if (!ex.phone && phone) ex.phone = phone
        if (ex.name === 'Гость' && name !== 'Гость') ex.name = name
      }
    } else clientsMap.set(key, { name, phone, count: 1, last: t })
  }
  const clients = [...clientsMap.entries()].map(([key, c]) => ({ key, ...c })).sort((a, b) => b.count - a.count)
  const clientBookings = clientFilter ? (bookings ?? []).filter(b => clientKey(b) === clientFilter) : []

  // Фильтр истории (#18)
  const hq = historyQuery.trim().toLowerCase()
  const pastFiltered = hq
    ? past.filter(b =>
        (b.client?.name ?? b.guestName ?? '').toLowerCase().includes(hq) ||
        (b.client?.phone ?? b.guestPhone ?? '').toLowerCase().includes(hq) ||
        (b.resource?.venue?.name ?? '').toLowerCase().includes(hq),
      )
    : past

  const statusPieData = analytics
    ? Object.entries(analytics.byStatus).map(([name, value]) => ({
        name: STATUS_LABELS[name]?.label ?? name,
        value,
      }))
    : []

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Кабинет владельца</h1>

      <Tabs defaultValue="bookings">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="bookings">
            Заявки
            {pending.length > 0 && (
              <Badge className="ml-2 h-5 min-w-5 px-1 text-xs">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="clients">Клиенты</TabsTrigger>
          <TabsTrigger value="venues">Заведения</TabsTrigger>
          <TabsTrigger value="moderation">Модерация</TabsTrigger>
          <TabsTrigger value="discounts">Скидки</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="staff">Сотрудники</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>

        {/* Bookings Tab */}
        <TabsContent value="bookings">
          <div className="flex justify-end mb-4">
            <Button size="sm" variant="outline" onClick={() => setWalkInOpen(true)} className="gap-1.5">
              <UserCheck className="h-4 w-4" />Walk-in бронь
            </Button>
          </div>
          {bookingsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
          ) : (
            <div className="space-y-6">
              {pending.length > 0 && (
                <section>
                  <h2 className="font-semibold mb-3 text-orange-600">Новые заявки ({pending.length})</h2>
                  <div className="space-y-3">{pending.map(b => <BookingRow key={b.id} booking={b} onAction={(id, a) => actionMutation.mutate({ id, action: a })} />)}</div>
                </section>
              )}
              {confirmed.length > 0 && (
                <section>
                  <h2 className="font-semibold mb-3">Подтверждённые ({confirmed.length})</h2>
                  <div className="space-y-3">{confirmed.map(b => <BookingRow key={b.id} booking={b} onAction={(id, a) => actionMutation.mutate({ id, action: a })} />)}</div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                    <h2 className="font-semibold text-muted-foreground">История ({past.length})</h2>
                    <Input
                      placeholder="Поиск: имя, телефон, заведение…"
                      value={historyQuery}
                      onChange={e => setHistoryQuery(e.target.value)}
                      className="h-8 w-full sm:w-64 text-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    {pastFiltered.map(b => <BookingRow key={b.id} booking={b} onAction={(id, a) => actionMutation.mutate({ id, action: a })} />)}
                    {pastFiltered.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Ничего не найдено</p>}
                  </div>
                </section>
              )}
              {!bookings?.length && (
                <div className="text-center py-16 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Заявок пока нет</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Clients Tab (#3/#5) */}
        <TabsContent value="clients">
          {clientFilter ? (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setClientFilter(null)}>← Все клиенты</Button>
              <h2 className="font-semibold">
                {clients.find(c => c.key === clientFilter)?.name ?? 'Клиент'} · {clientBookings.length} броней
              </h2>
              <div className="space-y-3">
                {clientBookings.map(b => <BookingRow key={b.id} booking={b} onAction={(id, a) => actionMutation.mutate({ id, action: a })} />)}
              </div>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Клиентов пока нет</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map(c => (
                <button key={c.key} onClick={() => setClientFilter(c.key)} className="block w-full text-left">
                  <Card className="hover:border-primary/40 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                      </div>
                      <Badge variant="secondary" className="shrink-0">{c.count} броней</Badge>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Venues Tab */}
        <TabsContent value="venues">
          <div className="flex justify-end mb-4">
            <Link href="/owner/venues/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />Добавить заведение
              </Button>
            </Link>
          </div>
          {venuesLoading ? (
            <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
          ) : !venues?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-3">У вас ещё нет заведений</p>
              <Link href="/owner/venues/new">
                <Button variant="outline"><Plus className="h-4 w-4 mr-1" />Создать первое</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {venues.map(v => (
                <Card key={v.id}>
                  <CardContent className="p-4 flex items-start gap-4">
                    {v.photos[0] && (
                      <img src={v.photos[0]} alt={v.name} className="h-20 w-28 object-cover rounded-lg shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold truncate">{v.name}</h3>
                        <Badge
                          variant={v.contentStatus === 'PUBLISHED' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {v.contentStatus === 'PUBLISHED' ? 'Опубликовано'
                            : v.contentStatus === 'PENDING_REVIEW' ? 'На модерации'
                            : v.contentStatus === 'REJECTED' ? 'Отклонено'
                            : v.contentStatus === 'NEEDS_REVISION' ? 'На доработке'
                            : 'Черновик'}
                        </Badge>
                        {v.hasPendingEdit && (
                          <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700">
                            <Clock className="h-3 w-3" />Изменения на модерации
                          </Badge>
                        )}
                      </div>
                      {v.hasPendingEdit && (
                        <p className="mt-1 text-xs rounded bg-amber-50 px-2 py-1 text-amber-800">
                          Ваши правки контента отправлены на модерацию. В каталоге пока прежняя версия — обновится после одобрения. Здесь показан ваш новый вариант.
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <MapPin className="h-3 w-3" />{v.address}
                      </div>
                      <p className="text-xs text-muted-foreground">{v.resources.length} ресурсов · {v.category.nameRu}</p>
                      {v.moderation?.note && (v.contentStatus === 'NEEDS_REVISION' || v.contentStatus === 'REJECTED') && (
                        <p className={`mt-1.5 text-xs rounded px-2 py-1 ${
                          v.contentStatus === 'NEEDS_REVISION' ? 'bg-orange-50 text-orange-800' : 'bg-destructive/10 text-destructive'
                        }`}>
                          <span className="font-medium">{v.contentStatus === 'NEEDS_REVISION' ? 'На доработку: ' : 'Причина отклонения: '}</span>
                          {v.moderation.note}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Link href={`/owner/venues/${v.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                            <Settings className="h-3 w-3" />Управление
                          </Button>
                        </Link>
                        {(v.contentStatus === 'DRAFT' || v.contentStatus === 'REJECTED' || v.contentStatus === 'NEEDS_REVISION') && (
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => submitMutation.mutate(v.id)}
                            disabled={submitMutation.isPending}
                          >
                            {v.contentStatus === 'NEEDS_REVISION' ? 'Отправить повторно' : 'На модерацию'}
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
                          onClick={() => setEmbedOpenId(embedOpenId === v.id ? null : v.id)}
                        >
                          <Code2 className="h-3 w-3" />Виджет
                        </Button>
                      </div>
                      {embedOpenId === v.id && <EmbedCodeBlock venueId={v.id} />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Moderation history Tab */}
        <TabsContent value="moderation">
          <ModerationHistoryTab />
        </TabsContent>

        {/* Discounts Tab */}
        <TabsContent value="discounts">
          {venuesLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : !venues?.length ? (
            <p className="text-muted-foreground">Нет заведений для настройки скидок</p>
          ) : (
            <div className="space-y-6">
              {venues.map(v => (
                <Card key={v.id}>
                  <CardContent className="p-4">
                    <VenueDiscounts venue={v} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          {analyticsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : !analytics ? (
            <p className="text-muted-foreground">Данных нет</p>
          ) : (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Всего броней</p>
                    <p className="text-3xl font-bold">{analytics.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Выручка (₸)</p>
                    <p className="text-3xl font-bold">{analytics.revenue.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Конверсия</p>
                    <p className="text-3xl font-bold">{analytics.conversionRate}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Неявки</p>
                    <p className="text-3xl font-bold">{analytics.noShowRate}%</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Status pie chart */}
                {statusPieData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Статусы броней</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {statusPieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Peak hours bar chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Загрузка по часам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.peakHours} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip labelFormatter={v => `Час: ${v}`} />
                        <Bar dataKey="count" fill="#7101F1" radius={[4, 4, 0, 0]} name="Брони" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Bookings by day line chart */}
              {analytics.bookingsByDay.length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Динамика броней</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={analytics.bookingsByDay} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#7101F1" strokeWidth={2} dot={false} name="Броней" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
        {/* Staff Tab */}
        <TabsContent value="staff">
          <StaffTab />
        </TabsContent>

        {/* Settings Tab — смена пароля владельца (правка #46) */}
        <TabsContent value="settings">
          <div className="max-w-2xl space-y-4">
            <ChangePasswordCard />
            <AppearanceCard />
            <LogoutCard />
          </div>
        </TabsContent>
      </Tabs>

      {/* Walk-in dialog */}
      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />Walk-in / ручная бронь
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ресурс</Label>
              <Select value={walkInData.resourceId} onValueChange={v => setWalkInData(p => ({ ...p, resourceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите ресурс" /></SelectTrigger>
                <SelectContent>
                  {(venues ?? []).flatMap(venue =>
                    (venue.resources ?? []).map(r => (
                      <SelectItem key={r.id} value={r.id}>{venue.name} — {r.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Дата</Label>
                <Input type="date" value={walkInData.date} onChange={e => setWalkInData(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Начало</Label>
                <Input type="time" value={walkInData.startTime} onChange={e => setWalkInData(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Конец</Label>
                <Input type="time" value={walkInData.endTime} onChange={e => setWalkInData(p => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Гостей</Label>
                <Input type="number" min={1} max={100} value={walkInData.guests} onChange={e => setWalkInData(p => ({ ...p, guests: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Имя гостя</Label>
                <Input placeholder="Иван" value={walkInData.guestName} onChange={e => setWalkInData(p => ({ ...p, guestName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Телефон гостя (необязательно)</Label>
              <PhoneInput value={walkInData.guestPhone} onChange={v => setWalkInData(p => ({ ...p, guestPhone: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Комментарий</Label>
              <Input placeholder="Особые пожелания" value={walkInData.comment} onChange={e => setWalkInData(p => ({ ...p, comment: e.target.value }))} />
            </div>
            {walkInTimeError && (
              <p className="text-xs text-destructive">{walkInTimeError}</p>
            )}
            <Button
              className="w-full"
              disabled={!walkInData.resourceId || !walkInData.guestName || !!walkInTimeError || walkInMutation.isPending}
              onClick={() => walkInMutation.mutate()}
            >
              {walkInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Создать бронь'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StaffTab() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const { data: staff = [], isLoading } = useQuery<ApiStaffMember[]>({
    queryKey: ['staff'],
    queryFn: () => api.staff.list(),
  })

  const addMutation = useMutation({
    mutationFn: () => api.staff.add(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setEmail('')
      toast.success('Сотрудник добавлен')
    },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.staff.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success('Сотрудник удалён')
    },
  })

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />Добавить сотрудника
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={e => e.key === 'Enter' && email && addMutation.mutate()}
            />
            <Button
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={!email.trim() || addMutation.isPending}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : staff.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p>Сотрудников нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <Card key={s.id}>
              <CardContent className="p-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{s.user.name}</p>
                  <p className="text-xs text-muted-foreground">{s.user.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeMutation.mutate(s.id)}
                  disabled={removeMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OwnerPage() {
  return <Suspense><OwnerContent /></Suspense>
}

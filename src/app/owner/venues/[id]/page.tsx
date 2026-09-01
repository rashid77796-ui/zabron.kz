'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ApiResource, type ApiVenueHours, type ApiBlackout, type ApiReviewFull, type ApiVenue, type ApiVenueQuestion } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { geocodeAddress } from '@/lib/geocode'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Power, PowerOff, Clock, Star, ScanLine, Pencil, Check, X, MapPin, Loader2 } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { PhotoUploadField } from '@/components/PhotoUploadField'
import { CollapsibleMap } from '@/components/CollapsibleMap'
import { CharCounter } from '@/components/CharCounter'
import { z } from 'zod'
import { createVenueSchema, venueIssuesToFieldErrors } from '@/lib/schemas/venue'

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// Карта для выбора точки заведения кликом/перетаскиванием маркера (правка #1). Только на клиенте.
const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false })

// ─── Resource form (inline) ───────────────────────────────────────────────────

function ResourceForm({ venueId, resource, onSaved, onCancel }: {
  venueId: string
  resource?: ApiResource
  onSaved: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: resource?.name ?? '',
    capacity: resource?.capacity ?? 4,
    quantity: resource?.quantity ?? 1,
    pricePerHour: resource?.pricePerHour ?? '',
    price: resource?.price ?? '',
    bookingDeposit: resource?.bookingDeposit ?? '',
    defaultDurationMin: resource?.defaultDurationMin ?? 120,
    categoryId: resource?.categoryId ?? '',
    photos: resource?.photos ?? [] as string[],
  })
  const { data: resCategories } = useQuery({ queryKey: ['categories'], queryFn: api.categories.list })

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        name: form.name,
        capacity: Number(form.capacity),
        quantity: Number(form.quantity),
        pricePerHour: form.pricePerHour !== '' ? Number(form.pricePerHour) : undefined,
        price: form.price !== '' ? Number(form.price) : undefined,
        bookingDeposit: form.bookingDeposit !== '' ? Number(form.bookingDeposit) : null,
        defaultDurationMin: Number(form.defaultDurationMin),
        categoryId: form.categoryId || null,
        photos: form.photos,
      }
      return resource
        ? api.resources.update(resource.id, data)
        : api.resources.create({ venueId, ...data })
    },
    onSuccess: () => { onSaved(); toast.success(resource ? 'Ресурс обновлён' : 'Ресурс создан') },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
      <h4 className="font-medium text-sm">{resource ? 'Редактировать ресурс' : 'Новый ресурс'}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Название</Label>
          <Input value={form.name} onChange={set('name')} placeholder="Сруб №1" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Вместимость (чел.)</Label>
          <Input type="number" min={1} value={form.capacity} onChange={set('capacity')} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Кол-во единиц</Label>
          <Input type="number" min={1} value={form.quantity} onChange={set('quantity')} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Цена ₸/ч (или пусто)</Label>
          <Input type="number" min={0} value={form.pricePerHour} onChange={set('pricePerHour')} placeholder="5000" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Фикс. цена ₸ (или пусто)</Label>
          <Input type="number" min={0} value={form.price} onChange={set('price')} placeholder="15000" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Длительность сеанса (мин)</Label>
          <Input type="number" min={30} step={30} value={form.defaultDurationMin} onChange={set('defaultDurationMin')} className="mt-1 h-8 text-sm" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Сумма брони (депозит) ₸ — необязательно</Label>
          <Input type="number" min={0} value={form.bookingDeposit} onChange={set('bookingDeposit')} placeholder="5000" className="mt-1 h-8 text-sm" />
          <p className="mt-0.5 text-[11px] text-muted-foreground">Клиент платит эту сумму заведению за бронь места, остаток — на месте. Онлайн-оплаты нет — счёт выставляете сами.</p>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Категория ресурса (необязательно)</Label>
          <select
            className="w-full mt-1 rounded-md border px-3 py-2 text-sm bg-background"
            value={form.categoryId}
            onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">Как у заведения</option>
            {resCategories?.map(c => <option key={c.id} value={c.id}>{c.nameRu}</option>)}
          </select>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Напр. боулинг — активный отдых, караоке — развлечения</p>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Фото</Label>
          <div className="mt-1">
            <PhotoUploadField
              value={form.photos}
              onChange={urls => setForm(f => ({ ...f, photos: urls }))}
              folder="resources"
              max={5}
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}>
          {mutation.isPending ? 'Сохраняем...' : 'Сохранить'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  )
}

// ─── Resources tab ────────────────────────────────────────────────────────────

function ResourcesTab({ venueId }: { venueId: string }) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  const { data: venue, isLoading } = useQuery({
    queryKey: ['my-venue-detail', venueId],
    queryFn: () => api.venues.myVenues().then(list => list.find(v => v.id === venueId)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.resources.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-venue-detail', venueId] })
      queryClient.invalidateQueries({ queryKey: ['my-venues'] })
      toast.success('Ресурс удалён')
    },
    onError: (e: Error) => {
      if (e.message === 'HAS_ACTIVE_BOOKINGS') toast.error('Есть активные брони — сначала отмените их')
      else toast.error('Ошибка', { description: e.message })
    },
  })

  const toggleBlockMutation = useMutation({
    mutationFn: ({ id, isBlocked }: { id: string; isBlocked: boolean }) =>
      api.resources.update(id, { isBlocked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-venue-detail', venueId] })
      toast.success('Статус обновлён')
    },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-venue-detail', venueId] })
    queryClient.invalidateQueries({ queryKey: ['my-venues'] })
  }

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />

  const resources = venue?.resources ?? []

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{resources.length} ресурсов</p>
        <Button size="sm" variant="outline" onClick={() => { setShowNewForm(true); setEditingId(null) }}>
          <Plus className="h-4 w-4 mr-1" />Добавить
        </Button>
      </div>

      {showNewForm && (
        <ResourceForm
          venueId={venueId}
          onSaved={() => { setShowNewForm(false); refresh() }}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {resources.map(r => (
        <div key={r.id}>
          {editingId === r.id ? (
            <ResourceForm
              venueId={venueId}
              resource={r}
              onSaved={() => { setEditingId(null); refresh() }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <Card>
              <CardContent className="p-3 flex items-center gap-3">
                {r.photos[0] && (
                  <img src={r.photos[0]} alt="" className="h-14 w-20 object-cover rounded-lg shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.name}</span>
                    {r.isBlocked && <Badge variant="destructive" className="text-xs">Заблокирован</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.capacity} чел. · {r.quantity} ед. · {r.defaultDurationMin} мин.
                    {r.pricePerHour ? ` · ${r.pricePerHour.toLocaleString()} ₸/ч` : r.price ? ` · ${r.price.toLocaleString()} ₸` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(r.id)}>
                    Ред.
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className={`h-7 w-7 p-0 ${r.isBlocked ? 'text-green-600' : 'text-orange-500'}`}
                    title={r.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                    onClick={() => toggleBlockMutation.mutate({ id: r.id, isBlocked: !r.isBlocked })}
                  >
                    {r.isBlocked ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                  </Button>
                  <ConfirmButton
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-destructive"
                    triggerTitle="Удалить ресурс"
                    title="Удалить ресурс?"
                    description="Кабинка/ресурс будет удалён. Это действие необратимо."
                    confirmLabel="Удалить"
                    onConfirm={() => deleteMutation.mutate(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </ConfirmButton>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ))}

      {resources.length === 0 && !showNewForm && (
        <p className="text-sm text-muted-foreground py-4 text-center">Нет ресурсов. Добавьте первый!</p>
      )}
    </div>
  )
}

// ─── Hours tab ────────────────────────────────────────────────────────────────

function HoursTab({ venueId }: { venueId: string }) {
  const queryClient = useQueryClient()

  const { data: savedHours, isLoading } = useQuery({
    queryKey: ['venue-hours-edit', venueId],
    queryFn: () => api.resources.getHours(venueId),
  })

  // Local state: 7 days, each with open/close or closed
  const [hours, setHours] = useState<{ open: boolean; openTime: string; closeTime: string }[]>(
    Array.from({ length: 7 }, () => ({ open: false, openTime: '10:00', closeTime: '22:00' }))
  )
  // Работа без выходных / круглосуточно — все 7 дней открыты 00:00–00:00.
  // В slots.ts равные open/close трактуются как 24 часа.
  const [allDay, setAllDay] = useState(false)

  // Populate from saved data
  useEffect(() => {
    if (!savedHours) return
    const next = Array.from({ length: 7 }, (_, day) => {
      const saved = savedHours.find(h => h.dayOfWeek === day)
      return saved
        ? { open: true, openTime: saved.openTime, closeTime: saved.closeTime }
        : { open: false, openTime: '10:00', closeTime: '22:00' }
    })
    setHours(next)
    setAllDay(next.every(d => d.open && d.openTime === d.closeTime))
  }, [savedHours])

  const toggleAllDay = (checked: boolean) => {
    setAllDay(checked)
    if (checked) {
      setHours(h => h.map(() => ({ open: true, openTime: '00:00', closeTime: '00:00' })))
    } else {
      // снимаем круглосуточный режим — возвращаем редактируемые часы
      setHours(h => h.map(d => d.openTime === d.closeTime ? { ...d, openTime: '10:00', closeTime: '22:00' } : d))
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const toSave = hours
        .map((h, day) => ({ dayOfWeek: day, openTime: h.openTime, closeTime: h.closeTime, open: h.open }))
        .filter(h => h.open)
        .map(({ dayOfWeek, openTime, closeTime }) => ({ dayOfWeek, openTime, closeTime }))
      return api.resources.setHours(venueId, toSave)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-hours-edit', venueId] })
      toast.success('Расписание сохранено')
    },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2.5">
        <input
          type="checkbox"
          checked={allDay}
          onChange={e => toggleAllDay(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm font-medium">Работа без выходных</span>
        <span className="text-xs text-muted-foreground">— открыто круглосуточно, все дни</span>
      </label>

      {allDay ? (
        <p className="text-xs text-muted-foreground">
          Заведение активно постоянно — 7 дней в неделю, 24 часа. Снимите галочку, чтобы задать часы по дням.
        </p>
      ) : (
        <>
      <p className="text-xs text-muted-foreground">Поддерживаются ночные смены (напр. 10:00 – 03:00)</p>
      <div className="space-y-2">
        {DAY_NAMES.map((name, day) => (
          <div key={day} className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <div className="w-8 text-sm font-medium shrink-0">{name}</div>
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={hours[day].open}
                onChange={e => setHours(h => h.map((x, i) => i === day ? { ...x, open: e.target.checked } : x))}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">{hours[day].open ? 'Открыто' : 'Закрыто'}</span>
            </label>
            {hours[day].open && (
              <div className="flex items-center gap-2 ml-auto">
                <Input
                  type="time"
                  value={hours[day].openTime}
                  onChange={e => setHours(h => h.map((x, i) => i === day ? { ...x, openTime: e.target.value } : x))}
                  className="h-7 w-28 text-xs"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={hours[day].closeTime}
                  onChange={e => setHours(h => h.map((x, i) => i === day ? { ...x, closeTime: e.target.value } : x))}
                  className="h-7 w-28 text-xs"
                />
              </div>
            )}
          </div>
        ))}
      </div>
        </>
      )}
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Сохраняем...' : 'Сохранить расписание'}
      </Button>
    </div>
  )
}

// ─── Blackouts tab ────────────────────────────────────────────────────────────

function BlackoutsTab({ venueId }: { venueId: string }) {
  const queryClient = useQueryClient()
  const [selectedResourceId, setSelectedResourceId] = useState('')
  const [form, setForm] = useState({ startAt: '', endAt: '', reason: '' })
  const [showForm, setShowForm] = useState(false)

  const { data: venue } = useQuery({
    queryKey: ['my-venue-detail', venueId],
    queryFn: () => api.venues.myVenues().then(list => list.find(v => v.id === venueId)),
  })

  const resourceId = selectedResourceId || venue?.resources[0]?.id || ''

  const { data: blackouts, isLoading } = useQuery({
    queryKey: ['blackouts', resourceId],
    queryFn: () => api.resources.getBlackouts(resourceId),
    enabled: !!resourceId,
  })

  const createMutation = useMutation({
    mutationFn: () => api.resources.createBlackout({
      resourceId,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      reason: form.reason || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackouts', resourceId] })
      setForm({ startAt: '', endAt: '', reason: '' })
      setShowForm(false)
      toast.success('Блокировка создана')
    },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.resources.deleteBlackout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackouts', resourceId] })
      toast.success('Блокировка удалена')
    },
  })

  const resources = venue?.resources ?? []

  return (
    <div className="space-y-4">
      {resources.length > 1 && (
        <div>
          <Label className="text-xs mb-1 block">Ресурс</Label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            value={resourceId}
            onChange={e => setSelectedResourceId(e.target.value)}
          >
            {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Clock className="h-4 w-4" />Блокировки
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-4 w-4 mr-1" />Добавить
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Начало</Label>
              <Input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Конец</Label>
              <Input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} className="mt-1 h-8 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Причина (необязательно)</Label>
              <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Техническое обслуживание" className="mt-1 h-8 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.startAt || !form.endAt}>
              Сохранить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-16 w-full rounded" />
      ) : !blackouts?.length ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Нет активных блокировок</p>
      ) : (
        <div className="space-y-2">
          {blackouts.map((b: ApiBlackout) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-xs">
                  {new Date(b.startAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                  {' – '}
                  {new Date(b.endAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
                {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
              </div>
              <ConfirmButton
                size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                triggerTitle="Удалить блокировку"
                title="Удалить блокировку?"
                description="Блокировка времени будет удалена. Это действие необратимо."
                confirmLabel="Удалить"
                onConfirm={() => deleteMutation.mutate(b.id)}
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

// ─── Info tab ─────────────────────────────────────────────────────────────────

function InfoTab({ venue }: { venue: ApiVenue }) {
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    name: venue.name,
    description: venue.description,
    address: venue.address,
    phone: venue.phone ?? '',
    instagram: venue.instagram ?? '',
    website: venue.website ?? '',
    twogis: venue.twogis ?? '',
    tiktok: venue.tiktok ?? '',
    lat: String(venue.lat),
    lng: String(venue.lng),
    categoryId: venue.category.id,
    photos: venue.photos as string[],
    bookingHorizonDays: String(venue.bookingHorizonDays ?? 14),         // правка #6
    cancellationCutoffHours: String(venue.cancellationCutoffHours ?? 0), // правка #14
    // Автоприём заявок (правка #53)
    autoRejectMinutesBeforeStart: String(venue.autoRejectMinutesBeforeStart ?? 30),
    minLeadTimeMinutes: String(venue.minLeadTimeMinutes ?? 0),
    autoRejectNoShowThreshold: venue.autoRejectNoShowThreshold != null ? String(venue.autoRejectNoShowThreshold) : '',
    autoConfirmUnanswered: venue.autoConfirmUnanswered ?? false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [geocoding, setGeocoding] = useState(false)

  // Найти координаты по адресу и заполнить точку на карте (правка #45)
  const handleGeocode = async () => {
    if (!form.address.trim()) return
    setGeocoding(true)
    const res = await geocodeAddress(form.address.trim())
    setGeocoding(false)
    if (res) {
      setForm(f => ({ ...f, lat: String(res.lat), lng: String(res.lng) }))
      toast.success('Адрес найден на карте')
    } else {
      toast.error('Адрес не найден', { description: 'Поставьте точку на карте вручную' })
    }
  }

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
  })

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof createVenueSchema>) => api.venues.update(venue.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-venues'] })
      // Точный текст — в handleSave (per-call onSuccess), т.к. зависит от того,
      // ушёл ли контент на модерацию (правка #19).
    },
    onError: (e: Error & { issues?: z.ZodIssue[] }) => {
      if (e.issues?.length) {
        const fieldErrors = venueIssuesToFieldErrors(e.issues, form)
        setErrors(fieldErrors)
        toast.error('Проверьте заполнение полей', { description: Object.values(fieldErrors)[0] })
        return
      }
      toast.error('Не удалось сохранить', { description: e.message })
    },
  })

  const handleSave = () => {
    const payload = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      phone: form.phone || undefined,
      instagram: form.instagram.trim() || undefined,
      website: form.website.trim() || undefined,
      twogis: form.twogis.trim() || undefined,
      tiktok: form.tiktok.trim() || undefined,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      photos: form.photos,
      bookingHorizonDays: Number(form.bookingHorizonDays) || 14,
      cancellationCutoffHours: Number(form.cancellationCutoffHours) || 0,
      autoRejectMinutesBeforeStart: Number(form.autoRejectMinutesBeforeStart) || 0,
      minLeadTimeMinutes: Number(form.minLeadTimeMinutes) || 0,
      autoRejectNoShowThreshold: form.autoRejectNoShowThreshold !== '' ? Number(form.autoRejectNoShowThreshold) : null,
      autoConfirmUnanswered: form.autoConfirmUnanswered,
    }
    const result = createVenueSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors = venueIssuesToFieldErrors(result.error.issues, payload)
      setErrors(fieldErrors)
      toast.error('Проверьте заполнение полей', { description: Object.values(fieldErrors)[0] })
      return
    }
    setErrors({})

    // Определяем, уйдёт ли что-то на модерацию, чтобы показать точный текст (правка #19).
    const contentChanged =
      result.data.name !== venue.name ||
      result.data.description !== venue.description ||
      JSON.stringify(result.data.photos) !== JSON.stringify(venue.photos)
    const goesToModeration = venue.contentStatus === 'PUBLISHED' && contentChanged

    mutation.mutate(result.data, {
      onSuccess: () => {
        if (goesToModeration) {
          toast.success('Изменения контента отправлены на модерацию', {
            description: 'В каталоге пока прежняя версия — обновится после одобрения. Остальные поля обновлены сразу.',
          })
        } else {
          toast.success('Изменения сохранены и уже видны')
        }
      },
    })
  }

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(f => ({ ...f, [k]: e.target.value }))
      setErrors(prev => (prev[k] ? { ...prev, [k]: '' } : prev))
    }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Название</Label>
          <Input value={form.name} onChange={set('name')} aria-invalid={!!errors.name}
            className={`mt-1 h-9 text-sm ${errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
          <div className="mt-1 flex justify-between gap-2 text-xs">
            <span className="text-destructive">{errors.name}</span>
            <CharCounter value={form.name} min={2} max={100} />
          </div>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Описание</Label>
          <Textarea value={form.description} onChange={set('description')} rows={3} aria-invalid={!!errors.description}
            className={`mt-1 text-sm ${errors.description ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
          <div className="mt-1 flex justify-between gap-2 text-xs">
            <span className="text-destructive">{errors.description}</span>
            <CharCounter value={form.description} min={10} max={2000} />
          </div>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Адрес</Label>
          <div className="mt-1 flex gap-2">
            <Input value={form.address} onChange={set('address')} aria-invalid={!!errors.address}
              className={`h-9 text-sm flex-1 ${errors.address ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
            <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={handleGeocode} disabled={geocoding || !form.address.trim()}>
              {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MapPin className="h-4 w-4 mr-1" />Найти на карте</>}
            </Button>
          </div>
          <div className="mt-1 flex justify-between gap-2 text-xs">
            <span className="text-destructive">{errors.address}</span>
            <CharCounter value={form.address} min={5} max={200} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Телефон</Label>
          <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Категория</Label>
          <select
            className="w-full mt-1 rounded-md border px-3 py-2 text-sm bg-background"
            value={form.categoryId}
            onChange={set('categoryId')}
          >
            {categories?.map(c => <option key={c.id} value={c.id}>{c.nameRu}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Широта (lat)</Label>
          <Input type="number" step="0.0001" value={form.lat} onChange={set('lat')} className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Долгота (lng)</Label>
          <Input type="number" step="0.0001" value={form.lng} onChange={set('lng')} className="mt-1 h-9 text-sm" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Точка на карте</Label>
          <div className="mt-1">
            <CollapsibleMap defaultOpen label="Показать карту" hideLabel="Свернуть карту">
              <LocationPicker
                lat={parseFloat(form.lat) || 0}
                lng={parseFloat(form.lng) || 0}
                onChange={(lat, lng) => setForm(f => ({ ...f, lat: String(lat), lng: String(lng) }))}
              />
            </CollapsibleMap>
          </div>
        </div>
        <div>
          <Label className="text-xs">Instagram</Label>
          <Input value={form.instagram} onChange={set('instagram')} placeholder="@username или ссылка" className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Сайт</Label>
          <Input value={form.website} onChange={set('website')} placeholder="https://…" className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">2ГИС</Label>
          <Input value={form.twogis} onChange={set('twogis')} placeholder="Ссылка 2ГИС" className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">TikTok</Label>
          <Input value={form.tiktok} onChange={set('tiktok')} placeholder="@username или ссылка" className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Бронь открыта на, дней вперёд</Label>
          <Input type="number" min={1} max={365} value={form.bookingHorizonDays} onChange={set('bookingHorizonDays')} className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Запрет отмены за, часов до сеанса</Label>
          <Input type="number" min={0} max={720} value={form.cancellationCutoffHours} onChange={set('cancellationCutoffHours')} className="mt-1 h-9 text-sm" />
          <p className="mt-1 text-[11px] text-muted-foreground">0 — без ограничений</p>
        </div>

        {/* Автоприём и автоотклонение заявок (правка #53) */}
        <div className="col-span-2 mt-1 rounded-xl border p-3 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">Автоматика по заявкам</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Авто-отклонение неотвеченных за, минут до начала</Label>
              <Input type="number" min={0} max={1440} value={form.autoRejectMinutesBeforeStart} onChange={set('autoRejectMinutesBeforeStart')} className="mt-1 h-9 text-sm" />
              <p className="mt-1 text-[11px] text-muted-foreground">Если не подтвердили заявку — за столько минут до сеанса система решит за вас</p>
            </div>
            <div>
              <Label className="text-xs">Мин. время до брони, минут</Label>
              <Input type="number" min={0} max={10080} value={form.minLeadTimeMinutes} onChange={set('minLeadTimeMinutes')} className="mt-1 h-9 text-sm" />
              <p className="mt-1 text-[11px] text-muted-foreground">Нельзя бронировать позже чем за N минут до начала. 0 — без ограничений</p>
            </div>
            <div>
              <Label className="text-xs">Отклонять клиентов с неявками от, шт.</Label>
              <Input type="number" min={1} max={100} value={form.autoRejectNoShowThreshold} onChange={set('autoRejectNoShowThreshold')} placeholder="не ограничивать" className="mt-1 h-9 text-sm" />
              <p className="mt-1 text-[11px] text-muted-foreground">Клиенты с таким числом неявок не смогут бронировать. Пусто — не ограничивать</p>
            </div>
            <div className="flex items-start gap-2 pt-5">
              <Switch
                id="autoConfirmUnanswered"
                checked={form.autoConfirmUnanswered}
                onCheckedChange={v => setForm(f => ({ ...f, autoConfirmUnanswered: v }))}
              />
              <Label htmlFor="autoConfirmUnanswered" className="text-xs leading-snug">
                Автоматически подтверждать неотвеченные заявки
                <span className="block font-normal text-muted-foreground">Вместо отклонения — подтверждать по истечении времени</span>
              </Label>
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Фото</Label>
          <div className="mt-1">
            <PhotoUploadField
              value={form.photos}
              onChange={urls => setForm(f => ({ ...f, photos: urls }))}
              folder="venues"
            />
          </div>
        </div>
      </div>
      <Button onClick={handleSave} disabled={mutation.isPending}>
        {mutation.isPending ? 'Сохраняем...' : 'Сохранить изменения'}
      </Button>
    </div>
  )
}

// ─── Reviews tab ──────────────────────────────────────────────────────────────

function ReviewsTab({ venueId }: { venueId: string }) {
  const queryClient = useQueryClient()
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['venue-reviews', venueId],
    queryFn: () => api.reviews.list(venueId),
  })

  const responseMutation = useMutation({
    mutationFn: (id: string) => api.reviews.addResponse(id, responseText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-reviews', venueId] })
      setRespondingId(null)
      setResponseText('')
      toast.success('Ответ опубликован')
    },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />

  const reviews = (data?.items ?? []) as ApiReviewFull[]

  if (!reviews.length) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Star className="h-10 w-10 mx-auto mb-2 opacity-20" />
        <p className="text-sm">Отзывов пока нет</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map(r => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">{r.client.name}</span>
                  <div className="flex gap-0.5 text-yellow-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-current' : 'fill-none opacity-30'}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
              {!r.merchantResponse && respondingId !== r.id && (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs shrink-0"
                  onClick={() => { setRespondingId(r.id); setResponseText('') }}
                >
                  Ответить
                </Button>
              )}
            </div>

            {r.text && <p className="text-sm mb-3">{r.text}</p>}

            {r.merchantResponse && (
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground font-medium mb-1">Ответ заведения:</p>
                <p>{r.merchantResponse}</p>
              </div>
            )}

            {respondingId === r.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  placeholder="Ваш ответ на отзыв..."
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => responseMutation.mutate(r.id)}
                    disabled={responseMutation.isPending || !responseText.trim()}
                  >
                    {responseMutation.isPending ? 'Публикуем...' : 'Опубликовать'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRespondingId(null)}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Check-in tab ─────────────────────────────────────────────────────────────

// Минимальный тип нативного BarcodeDetector (правка #20)
type BarcodeDetectorCtor = new (o: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

function CheckInTab() {
  const [code, setCode] = useState('')
  const [lastCheckedIn, setLastCheckedIn] = useState<{ name: string; resource: string; time: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const mutation = useMutation({
    mutationFn: (scannedCode?: string) => api.bookings.checkIn((scannedCode ?? code).trim().toUpperCase()),
    onSuccess: (booking) => {
      setLastCheckedIn({
        name: booking.client?.name ?? 'Клиент',
        resource: booking.resource.name,
        time: `${new Date(booking.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–${new Date(booking.endAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
      })
      setCode('')
      toast.success('Клиент заселён')
    },
    onError: (e: Error) => {
      const msgs: Record<string, string> = {
        NOT_FOUND: 'Код не найден',
        INVALID_STATUS: 'Бронь не в статусе "Подтверждена"',
        FORBIDDEN: 'Нет доступа к этой брони',
      }
      toast.error(msgs[e.message] ?? 'Ошибка', { description: msgs[e.message] ? undefined : e.message })
    },
  })

  // Сканирование QR камерой через нативный BarcodeDetector (правка #20).
  // Ручной ввод остаётся запасным способом при отсутствии поддержки/доступа.
  useEffect(() => {
    if (!scanning) return
    const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
    if (!BD) {
      setScanError('Сканер QR не поддерживается этим браузером — введите код вручную')
      setScanning(false)
      return
    }
    let stream: MediaStream | null = null
    let raf = 0
    let cancelled = false
    const detector = new BD({ formats: ['qr_code'] })

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        const tick = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0 && codes[0].rawValue) {
              const raw = codes[0].rawValue.trim().toUpperCase()
              setScanning(false)
              setCode(raw)
              mutation.mutate(raw)
              return
            }
          } catch { /* кадр без QR — продолжаем */ }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setScanError('Нет доступа к камере — введите код вручную')
        setScanning(false)
      }
    }
    run()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ScanLine className="h-4 w-4" />
        <p className="text-sm">Отсканируйте QR клиента или введите код заезда вручную.</p>
      </div>

      <div className="max-w-sm space-y-2">
        {scanning ? (
          <div className="space-y-2">
            <video ref={videoRef} className="w-full rounded-lg border bg-black aspect-video object-cover" muted playsInline />
            <Button variant="outline" size="sm" onClick={() => setScanning(false)} className="w-full">
              Остановить сканирование
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => { setScanError(null); setScanning(true) }} className="w-full gap-2">
            <ScanLine className="h-4 w-4" />Сканировать QR камерой
          </Button>
        )}
        {scanError && <p className="text-xs text-destructive">{scanError}</p>}
      </div>

      <div className="flex gap-2 max-w-sm">
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter' && code.trim()) mutation.mutate(undefined) }}
          placeholder="Код заезда"
          className="font-mono text-base h-10 tracking-widest uppercase"
          autoComplete="off"
          autoFocus
        />
        <Button
          onClick={() => mutation.mutate(undefined)}
          disabled={mutation.isPending || !code.trim()}
          className="h-10 px-5 shrink-0"
        >
          {mutation.isPending ? '...' : 'Заселить'}
        </Button>
      </div>

      {lastCheckedIn && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 max-w-sm">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">✓ Заезд подтверждён</p>
            <p className="text-sm"><span className="text-muted-foreground">Клиент:</span> {lastCheckedIn.name}</p>
            <p className="text-sm"><span className="text-muted-foreground">Ресурс:</span> {lastCheckedIn.resource}</p>
            <p className="text-sm"><span className="text-muted-foreground">Время:</span> {lastCheckedIn.time}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function VenueManageContent() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
    if (!authLoading && user && user.role !== 'merchant' && user.role !== 'super_admin') router.push('/')
  }, [user, authLoading, router])

  const { data: venues, isLoading } = useQuery({
    queryKey: ['my-venues'],
    queryFn: api.venues.myVenues,
    enabled: !!user,
  })

  const venue = venues?.find(v => v.id === params.id)

  const submitMutation = useMutation({
    mutationFn: () => api.moderation.submitVenue(params.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-venues'] })
      toast.success('Заявка на модерацию отправлена')
    },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  if (authLoading || !user || isLoading) return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="h-8 w-48 mb-6" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )

  if (!venue) return (
    <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
      Заведение не найдено
    </div>
  )

  const statusLabel: Record<string, string> = {
    DRAFT: 'Черновик',
    PENDING_REVIEW: 'На модерации',
    PUBLISHED: 'Опубликовано',
    REJECTED: 'Отклонено',
    NEEDS_REVISION: 'На доработке',
  }

  const canSubmit = venue.contentStatus === 'DRAFT'
    || venue.contentStatus === 'REJECTED'
    || venue.contentStatus === 'NEEDS_REVISION'
  const moderationNote = venue.moderation?.note
  const showModerationNote = moderationNote
    && (venue.contentStatus === 'NEEDS_REVISION' || venue.contentStatus === 'REJECTED')

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/owner">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{venue.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge
              variant={venue.contentStatus === 'PUBLISHED' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {statusLabel[venue.contentStatus] ?? venue.contentStatus}
            </Badge>
            <span className="text-xs text-muted-foreground">{venue.category.nameRu}</span>
          </div>
        </div>
        {canSubmit && (
          <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            {venue.contentStatus === 'NEEDS_REVISION' ? 'Отправить повторно' : 'На модерацию'}
          </Button>
        )}
      </div>

      {showModerationNote && (
        <div className={`mb-6 rounded-lg border p-4 ${
          venue.contentStatus === 'NEEDS_REVISION'
            ? 'border-orange-200 bg-orange-50 text-orange-900'
            : 'border-destructive/30 bg-destructive/10 text-destructive'
        }`}>
          <p className="font-medium text-sm mb-1">
            {venue.contentStatus === 'NEEDS_REVISION'
              ? 'Заявка возвращена на доработку'
              : 'Заявка отклонена'}
          </p>
          <p className="text-sm whitespace-pre-wrap break-words">{moderationNote}</p>
          <p className="text-xs mt-2 opacity-80">
            Внесите изменения во вкладке «Информация» и нажмите «Отправить повторно».
          </p>
        </div>
      )}

      <Tabs defaultValue="resources">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="resources">Ресурсы</TabsTrigger>
          <TabsTrigger value="hours">Расписание</TabsTrigger>
          <TabsTrigger value="blackouts">Блокировки</TabsTrigger>
          <TabsTrigger value="reviews">Отзывы</TabsTrigger>
          <TabsTrigger value="info">Информация</TabsTrigger>
          <TabsTrigger value="checkin">Заезд</TabsTrigger>
          <TabsTrigger value="questions">Вопросы</TabsTrigger>
        </TabsList>

        <TabsContent value="resources">
          <Card>
            <CardContent className="p-4">
              <ResourcesTab venueId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Часы работы</CardTitle>
            </CardHeader>
            <CardContent>
              <HoursTab venueId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blackouts">
          <Card>
            <CardContent className="p-4">
              <BlackoutsTab venueId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardContent className="p-4">
              <ReviewsTab venueId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Основная информация</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoTab venue={venue} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkin">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Подтверждение заезда</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckInTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="questions">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Кастомные вопросы в форме брони (макс. 3)</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionsTab venueId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function QuestionsTab({ venueId }: { venueId: string }) {
  const queryClient = useQueryClient()
  const { data: questions = [], isLoading } = useQuery<ApiVenueQuestion[]>({
    queryKey: ['venue-questions', venueId],
    queryFn: () => api.questions.list(venueId),
  })
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<'text' | 'select'>('text')
  const [newOptions, setNewOptions] = useState('')
  const [newRequired, setNewRequired] = useState(false)

  // Редактирование существующего вопроса
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editType, setEditType] = useState<'text' | 'select'>('text')
  const [editOptions, setEditOptions] = useState('')
  const [editRequired, setEditRequired] = useState(false)

  const startEdit = (q: ApiVenueQuestion) => {
    setEditingId(q.id)
    setEditText(q.text)
    setEditType(q.fieldType === 'select' ? 'select' : 'text')
    setEditOptions(q.options.join(', '))
    setEditRequired(q.isRequired)
  }
  const cancelEdit = () => setEditingId(null)

  const addMutation = useMutation({
    mutationFn: () => api.questions.create(venueId, {
      text: newText,
      fieldType: newType,
      options: newType === 'select' ? newOptions.split(',').map(o => o.trim()).filter(Boolean) : [],
      isRequired: newRequired,
      sortOrder: questions.length,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-questions', venueId] })
      setNewText('')
      setNewOptions('')
      setNewRequired(false)
      toast.success('Вопрос добавлен')
    },
    onError: (e: Error) => {
      if (e.message === 'MAX_QUESTIONS') toast.error('Максимум 3 вопроса')
      else toast.error('Ошибка', { description: e.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => api.questions.update(venueId, id, {
      text: editText,
      fieldType: editType,
      options: editType === 'select' ? editOptions.split(',').map(o => o.trim()).filter(Boolean) : [],
      isRequired: editRequired,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-questions', venueId] })
      setEditingId(null)
      toast.success('Вопрос обновлён')
    },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.questions.delete(venueId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venue-questions', venueId] }),
  })

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-xs text-muted-foreground">
        Задайте клиентам дополнительные вопросы при бронировании (напр. «Отметить ли событие?», «Предпочтения»).
      </p>

      {isLoading ? <Skeleton className="h-20 w-full" /> : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            editingId === q.id ? (
              <div key={q.id} className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-medium">Редактирование вопроса {i + 1}</p>
                <Input placeholder="Текст вопроса" value={editText} onChange={e => setEditText(e.target.value)} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-sm flex-1"
                    value={editType}
                    onChange={e => setEditType(e.target.value as 'text' | 'select')}
                  >
                    <option value="text">Текстовый ответ</option>
                    <option value="select">Выбор из вариантов</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={editRequired} onChange={e => setEditRequired(e.target.checked)} className="accent-primary" />
                    Обязательный
                  </label>
                </div>
                {editType === 'select' && (
                  <Input
                    placeholder="Вариант 1, Вариант 2, Вариант 3"
                    value={editOptions}
                    onChange={e => setEditOptions(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateMutation.mutate(q.id)} disabled={!editText.trim() || updateMutation.isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" />Сохранить
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit} disabled={updateMutation.isPending}>
                    <X className="h-3.5 w-3.5 mr-1" />Отмена
                  </Button>
                </div>
              </div>
            ) : (
            <div key={q.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{i + 1}. {q.text}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  [{q.fieldType}]{q.isRequired ? ' *' : ''}
                  {q.options.length > 0 ? ` (${q.options.join(', ')})` : ''}
                </span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={() => startEdit(q)} disabled={deleteMutation.isPending}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <ConfirmButton size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0"
                  disabled={deleteMutation.isPending}
                  triggerTitle="Удалить вопрос"
                  title="Удалить вопрос?"
                  description="Вопрос будет удалён. Это действие необратимо."
                  confirmLabel="Удалить"
                  onConfirm={() => deleteMutation.mutate(q.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </ConfirmButton>
              </div>
            </div>
            )
          ))}
        </div>
      )}

      {questions.length < 3 && (
        <div className="rounded-lg border p-3 space-y-3">
          <p className="text-xs font-medium">Новый вопрос</p>
          <Input placeholder="Текст вопроса" value={newText} onChange={e => setNewText(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-2">
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm flex-1"
              value={newType}
              onChange={e => setNewType(e.target.value as 'text' | 'select')}
            >
              <option value="text">Текстовый ответ</option>
              <option value="select">Выбор из вариантов</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} className="accent-primary" />
              Обязательный
            </label>
          </div>
          {newType === 'select' && (
            <Input
              placeholder="Вариант 1, Вариант 2, Вариант 3"
              value={newOptions}
              onChange={e => setNewOptions(e.target.value)}
              className="h-8 text-sm"
            />
          )}
          <Button size="sm" onClick={() => addMutation.mutate()} disabled={!newText.trim() || addMutation.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" />Добавить вопрос
          </Button>
        </div>
      )}
    </div>
  )
}

export default function VenueManagePage() {
  return <Suspense><VenueManageContent /></Suspense>
}

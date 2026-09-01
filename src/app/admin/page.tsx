'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiMerchantAdmin, ApiUserAdmin, ApiModerationRequest, ApiPlatformMetrics, ApiPromoBanner } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ChangePasswordCard } from '@/components/ChangePasswordCard'
import { AppearanceCard } from '@/components/AppearanceCard'
import { LogoutCard } from '@/components/LogoutCard'
import { PhotoUploadField } from '@/components/PhotoUploadField'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Users, Building2, Calendar, TrendingUp, CheckCircle2, XCircle,
  Star, Search, ShieldOff, RefreshCw, CheckCircle, Clock, MapPin, User,
  Phone, Banknote, Eye, Mail, ExternalLink, ImageOff, Plus, AlertTriangle,
} from 'lucide-react'

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

function formatResourcePrice(r: { pricePerHour: number | null; price: number | null }) {
  if (r.pricePerHour) return `${r.pricePerHour.toLocaleString('ru')} ₸/ч`
  if (r.price) return `${r.price.toLocaleString('ru')} ₸`
  return 'Цена не указана'
}

const merchantStatusLabels: Record<string, string> = {
  PENDING: 'Ожидают',
  ACTIVE: 'Активные',
  SUSPENDED: 'Заблокированы',
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    SUSPENDED: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {merchantStatusLabels[status] ?? status}
    </span>
  )
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800',
    moderator: 'bg-blue-100 text-blue-800',
    merchant: 'bg-orange-100 text-orange-800',
    client: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {role}
    </span>
  )
}

function ActivateDialog({ merchant, onClose }: { merchant: ApiMerchantAdmin; onClose: () => void }) {
  const qc = useQueryClient()
  const [dealAmount, setDealAmount] = useState('')
  const [dealPlan, setDealPlan] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const mut = useMutation({
    mutationFn: () => api.admin.activateMerchant(merchant.id, {
      dealAmount: dealAmount ? Number(dealAmount) : undefined,
      dealPlan: dealPlan || undefined,
      expiresAt: expiresAt || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-merchants'] })
      qc.invalidateQueries({ queryKey: ['admin-metrics'] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Активировать мерчанта</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{merchant.owner.name} · {merchant.owner.email}</p>
          <div className="space-y-1">
            <Label>Сумма сделки (KZT)</Label>
            <Input type="number" placeholder="150000" value={dealAmount} onChange={e => setDealAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Тарифный план</Label>
            <Input placeholder="Basic / Pro / Enterprise" value={dealPlan} onChange={e => setDealPlan(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Действует до</Label>
            <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? 'Активация...' : 'Активировать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FeatureDialog({ merchant, onClose }: { merchant: ApiMerchantAdmin; onClose: () => void }) {
  const qc = useQueryClient()
  const [until, setUntil] = useState(merchant.featuredUntil ? merchant.featuredUntil.slice(0, 10) : '')

  const mut = useMutation({
    mutationFn: () => api.admin.setFeatured(merchant.id, until || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-merchants'] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Featured — {merchant.owner.name}</DialogTitle></DialogHeader>
        <div className="space-y-1">
          <Label>Показывать до (пусто = убрать)</Label>
          <Input type="date" value={until} onChange={e => setUntil(e.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoleDialog({ user, onClose }: { user: ApiUserAdmin; onClose: () => void }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState(user.role)

  const mut = useMutation({
    mutationFn: () => api.admin.setUserRole(user.id, selected),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Роль — {user.name}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          {(['client', 'merchant', 'moderator', 'super_admin'] as const).map(r => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selected === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              {r}
            </button>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || selected === user.role}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const moderationStatusLabel: Record<string, string> = {
  PENDING: 'На проверке',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
  NEEDS_REVISION: 'На доработке',
}

function moderationStatusBadge(status: string) {
  const cls =
    status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
    status === 'APPROVED' ? 'bg-green-100 text-green-800' :
    status === 'NEEDS_REVISION' ? 'bg-orange-100 text-orange-800' :
    'bg-red-100 text-red-800'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {moderationStatusLabel[status] ?? status}
    </span>
  )
}

/** Детальный просмотр заявки на модерацию — read-only, как карточка заведения у мерчанта. */
function ModerationDetailDialog({ req, onApprove, onReject, onRevise, isLoading, onClose }: {
  req: ApiModerationRequest
  onApprove: (id: string) => void
  onReject: (id: string, note: string) => void
  onRevise: (id: string, note: string) => void
  isLoading: boolean
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const v = req.venue

  const Row = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium break-words">{children}</span>
      </div>
    </div>
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
            {v?.name ?? `${req.entityType} #${req.entityId.slice(0, 8)}`}
            {moderationStatusBadge(req.status)}
          </DialogTitle>
        </DialogHeader>

        {!v ? (
          <p className="py-8 text-center text-muted-foreground">Данные заведения недоступны</p>
        ) : (
          <div className="space-y-5">
            {/* Фотографии */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Фотографии ({v.photos.length})</p>
              {v.photos.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <ImageOff className="h-4 w-4" /> Фотографии не загружены
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {v.photos.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-lg border">
                      <img src={url} alt={`Фото ${i + 1}`} className="h-full w-full object-cover transition-transform hover:scale-105" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Основная информация */}
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Основная информация</p>
              <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Категория">{v.category.nameRu}</Row>
              <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Адрес">
                {v.address}
                {' '}
                <a href={`https://2gis.kz/geo/${v.lng},${v.lat}`} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-0.5 text-primary text-xs hover:underline">
                  на карте <ExternalLink className="h-3 w-3" />
                </a>
              </Row>
              <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Координаты">{v.lat}, {v.lng}</Row>
              <Row icon={<Phone className="h-3.5 w-3.5" />} label="Телефон">{v.phone || '—'}</Row>
            </div>

            {/* Описание */}
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Описание</p>
              <p className="text-sm whitespace-pre-wrap break-words">{v.description}</p>
            </div>

            {/* Владелец */}
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Владелец</p>
              <Row icon={<User className="h-3.5 w-3.5" />} label="Имя">{v.merchant.owner.name}</Row>
              <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email">{v.merchant.owner.email}</Row>
              <Row icon={<Phone className="h-3.5 w-3.5" />} label="Телефон">{v.merchant.owner.phone || '—'}</Row>
              <Row icon={<Clock className="h-3.5 w-3.5" />} label="Регистрация">
                {new Date(v.merchant.owner.createdAt).toLocaleDateString('ru-RU')}
              </Row>
            </div>

            {/* Ресурсы */}
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Ресурсы для бронирования ({v.resources.length})</p>
              {v.resources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ресурсы не добавлены</p>
              ) : (
                <div className="space-y-2">
                  {v.resources.map(r => (
                    <div key={r.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 p-2.5">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                          <Users className="h-3 w-3" />до {r.capacity} чел. · {r.quantity} ед. · {r.defaultDurationMin} мин.
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        <Banknote className="h-3.5 w-3.5" />{formatResourcePrice(r)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Часы работы */}
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Часы работы</p>
              {v.hours.length === 0 ? (
                <p className="text-sm text-muted-foreground">Не указаны</p>
              ) : (
                <div className="space-y-1">
                  {[...v.hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(h => (
                    <div key={h.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{DAY_NAMES[h.dayOfWeek] ?? `День ${h.dayOfWeek}`}</span>
                      <span className="font-medium">
                        {h.openTime === h.closeTime ? 'Круглосуточно' : `${h.openTime} – ${h.closeTime}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Предыдущая причина отклонения */}
            {req.note && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium mb-0.5">Причина отклонения</p>
                <p className="whitespace-pre-wrap break-words">{req.note}</p>
              </div>
            )}

            {/* Комментарий и действия модератора */}
            {req.status === 'PENDING' && (
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm">Комментарий модератора</Label>
                <p className="text-xs text-muted-foreground">
                  Обязателен для отклонения и отправки на доработку. Мерчант увидит этот комментарий.
                </p>
                <Textarea
                  placeholder="Опишите, что нужно исправить, или причину отклонения…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex flex-wrap gap-2 justify-end pt-1">
                  <Button
                    variant="destructive"
                    onClick={() => { onReject(req.id, note.trim()); onClose() }}
                    disabled={!note.trim() || isLoading}
                  >
                    <XCircle className="h-4 w-4 mr-1" />Отклонить
                  </Button>
                  <Button
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={() => { onRevise(req.id, note.trim()); onClose() }}
                    disabled={!note.trim() || isLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />На доработку
                  </Button>
                  <Button onClick={() => { onApprove(req.id); onClose() }} disabled={isLoading}>
                    <CheckCircle className="h-4 w-4 mr-1" />Одобрить и опубликовать
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ModerationCard({ req, onApprove, onReject, onOpenDetail, isLoading }: {
  req: ApiModerationRequest
  onApprove: (id: string) => void
  onReject: (id: string, note: string) => void
  onOpenDetail: (req: ApiModerationRequest) => void
  isLoading: boolean
}) {
  const [rejectNote, setRejectNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  // Какие поля контента владелец изменил (для правок опубликованного заведения) — правка: видимость изменений
  const cur = req.currentContent
  const isEdit = req.venue?.contentStatus === 'PUBLISHED' && !!cur
  const changedFields: string[] = []
  if (isEdit && cur!.name !== req.venue!.name) changedFields.push('название')
  if (isEdit && cur!.description !== req.venue!.description) changedFields.push('описание')
  if (isEdit && JSON.stringify(cur!.photos) !== JSON.stringify(req.venue!.photos)) changedFields.push('фото')

  // Что заведение не заполнило — чтобы модератор/админ видел пробелы сразу
  const gaps: string[] = []
  if (req.venue) {
    if (!req.venue.resources?.length) gaps.push('ресурсы (кабинки / столы / зоны)')
    if (!req.venue.hours?.length) gaps.push('рабочее время')
    if (!req.venue.photos?.length) gaps.push('фотографии')
    if (!req.venue.description?.trim()) gaps.push('описание')
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold">
                {req.venue?.name ?? req.entityType} #{req.entityId.slice(0, 8)}
              </span>
              {moderationStatusBadge(req.status)}
              {changedFields.length > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                  <Star className="h-2.5 w-2.5 fill-current" />изменено: {changedFields.join(', ')}
                </span>
              )}
            </div>
            {req.venue && (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{req.venue.address}</div>
                <div className="flex items-center gap-1"><Building2 className="h-3 w-3" />{req.venue.category.nameRu}</div>
                <div className="flex items-center gap-1"><User className="h-3 w-3" />{req.venue.merchant.owner.name} · {req.venue.merchant.owner.email}</div>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(req.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
          {!showRejectForm && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => onOpenDetail(req)}>
                <Eye className="h-4 w-4 mr-1" />Подробнее
              </Button>
              {req.status === 'PENDING' && (
                <>
                  <Button size="sm" onClick={() => onApprove(req.id)} disabled={isLoading}>
                    <CheckCircle className="h-4 w-4 mr-1" />Одобрить
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowRejectForm(true)} disabled={isLoading}>
                    <XCircle className="h-4 w-4 mr-1" />Отклонить
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        {gaps.length > 0 && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs">
            <p className="flex items-center gap-1 font-medium text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />Заведение заполнило не всё:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-700/90">
              {gaps.map(g => <li key={g}>Не указано: {g}</li>)}
            </ul>
          </div>
        )}
        {showRejectForm && (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Укажите причину отклонения (обязательно)"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              className="text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => { onReject(req.id, rejectNote); setShowRejectForm(false) }}
                disabled={!rejectNote.trim() || isLoading}
              >
                Подтвердить отклонение
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowRejectForm(false); setRejectNote('') }}>
                Отмена
              </Button>
            </div>
          </div>
        )}
        {req.note && (
          <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
            Причина: {req.note}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const MODERATION_FILTERS = ['PENDING', 'NEEDS_REVISION', 'APPROVED', 'REJECTED'] as const

function ModerationTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<(typeof MODERATION_FILTERS)[number]>('PENDING')
  const [detail, setDetail] = useState<ApiModerationRequest | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-moderation', statusFilter],
    queryFn: () => api.moderation.list({ status: statusFilter }),
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => api.moderation.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-moderation'] }); toast.success('Заведение опубликовано') },
    onError: () => toast.error('Ошибка при одобрении'),
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.moderation.reject(id, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-moderation'] }); toast.success('Заявка отклонена') },
    onError: () => toast.error('Ошибка при отклонении'),
  })

  const reviseMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.moderation.revise(id, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-moderation'] }); toast.success('Отправлено на доработку') },
    onError: () => toast.error('Не удалось отправить на доработку'),
  })

  const actionsLoading = approveMut.isPending || rejectMut.isPending || reviseMut.isPending
  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {MODERATION_FILTERS.map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
            {moderationStatusLabel[s]}
            {s === statusFilter && data ? ` (${data.total})` : ''}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>Нет заявок со статусом «{moderationStatusLabel[statusFilter]}»</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(req => (
            <ModerationCard
              key={req.id}
              req={req}
              onApprove={id => approveMut.mutate(id)}
              onReject={(id, note) => rejectMut.mutate({ id, note })}
              onOpenDetail={setDetail}
              isLoading={actionsLoading}
            />
          ))}
        </div>
      )}

      {detail && (
        <ModerationDetailDialog
          req={detail}
          onApprove={id => approveMut.mutate(id)}
          onReject={(id, note) => rejectMut.mutate({ id, note })}
          onRevise={(id, note) => reviseMut.mutate({ id, note })}
          isLoading={actionsLoading}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

function MerchantsTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [activating, setActivating] = useState<ApiMerchantAdmin | null>(null)
  const [featuring, setFeaturing] = useState<ApiMerchantAdmin | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-merchants', statusFilter],
    queryFn: () => api.admin.merchants({ status: statusFilter || undefined }),
  })

  const suspendMut = useMutation({
    mutationFn: (id: string) => api.admin.suspendMerchant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-merchants'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(['', 'PENDING', 'ACTIVE', 'SUSPENDED'] as const).map(s => (
          <Button key={s || 'all'} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
            {s ? merchantStatusLabels[s] ?? s : 'Все'}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {data?.items.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium">{m.owner.name}</p>
                      {statusBadge(m.status)}
                      {m.featuredUntil && new Date(m.featuredUntil) > new Date() && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                          <Star className="h-3 w-3" /> Featured
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{m.owner.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {m.venues.length} заведений
                      {m.dealPlan ? ` · ${m.dealPlan}` : ''}
                      {m.dealAmount ? ` · ${m.dealAmount.toLocaleString()} ${m.dealCurrency ?? 'KZT'}` : ''}
                      {m.expiresAt ? ` · до ${new Date(m.expiresAt).toLocaleDateString('ru')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setFeaturing(m)}>
                      <Star className="h-3.5 w-3.5 mr-1" /> Featured
                    </Button>
                    {m.status !== 'ACTIVE' && (
                      <Button size="sm" onClick={() => setActivating(m)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Активировать
                      </Button>
                    )}
                    {m.status === 'ACTIVE' && (
                      <ConfirmButton
                        size="sm"
                        variant="destructive"
                        disabled={suspendMut.isPending}
                        title="Заблокировать мерчанта?"
                        description={`Мерчант «${m.owner.name}» будет заблокирован, все его заведения (${m.venues.length}) снимутся с публикации. Действие можно отменить повторной активацией.`}
                        confirmLabel="Заблокировать"
                        onConfirm={() => suspendMut.mutate(m.id)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Заблокировать
                      </ConfirmButton>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!data?.items.length && <p className="text-center py-8 text-muted-foreground">Нет мерчантов</p>}
        </div>
      )}

      {activating && <ActivateDialog merchant={activating} onClose={() => setActivating(null)} />}
      {featuring && <FeatureDialog merchant={featuring} onClose={() => setFeaturing(null)} />}
    </div>
  )
}

// Фильтр по роли для списка пользователей (правка #28)
const ROLE_OPTIONS: { v: string; l: string }[] = [
  { v: '', l: 'Все' },
  { v: 'client', l: 'Клиенты' },
  { v: 'merchant', l: 'Мерчанты' },
  { v: 'moderator', l: 'Модераторы' },
  { v: 'super_admin', l: 'Админы' },
]

// Пагинация «‹ page/pages ›» — общая для вкладок админки (правки #26/#28)
function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>‹ Назад</Button>
      <span className="text-sm text-muted-foreground">{page} / {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Вперёд ›</Button>
    </div>
  )
}

function UsersTab() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ApiUserAdmin | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', query, role, page],
    queryFn: () => api.admin.users({ search: query || undefined, role: role || undefined, page }),
  })

  const applySearch = () => { setQuery(search); setPage(1) }
  const applyRole = (r: string) => { setRole(r); setPage(1) }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Поиск по имени или email"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applySearch()}
          className="max-w-xs"
        />
        <Button variant="outline" size="icon" onClick={applySearch}><Search className="h-4 w-4" /></Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ROLE_OPTIONS.map(o => (
          <Button key={o.v || 'all'} size="sm" variant={role === o.v ? 'default' : 'outline'} onClick={() => applyRole(o.v)}>
            {o.l}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : (
        <div className="space-y-2">
          {data?.items.map(u => (
            <Card key={u.id}>
              <CardContent className="p-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{u.name}</p>
                    {roleBadge(u.role)}
                    {u.merchant && statusBadge(u.merchant.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Роль</Button>
              </CardContent>
            </Card>
          ))}
          {!data?.items.length && <p className="text-center py-8 text-muted-foreground">Пользователей не найдено</p>}
          <Pager page={data?.page ?? 1} pages={data?.pages ?? 1} onChange={setPage} />
        </div>
      )}

      {editing && <RoleDialog user={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

// Типы объектов для фильтра аудит-лога (правка #26)
const AUDIT_ENTITY_OPTIONS: { v: string; l: string }[] = [
  { v: '', l: 'Все' },
  { v: 'User', l: 'Пользователи' },
  { v: 'Merchant', l: 'Мерчанты' },
  { v: 'Venue', l: 'Заведения' },
  { v: 'Booking', l: 'Брони' },
  { v: 'ModerationRequest', l: 'Модерация' },
]

function AuditTab() {
  const [entityType, setEntityType] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', entityType, page],
    queryFn: () => api.admin.auditLogs({ entityType: entityType || undefined, page }),
  })

  const applyEntity = (v: string) => { setEntityType(v); setPage(1) }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {AUDIT_ENTITY_OPTIONS.map(o => (
          <Button key={o.v || 'all'} size="sm" variant={entityType === o.v ? 'default' : 'outline'} onClick={() => applyEntity(o.v)}>
            {o.l}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : (
        <div className="space-y-2">
          {data?.items.map(log => (
            <div key={log.id} className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/40 text-sm">
              <span className="font-mono text-xs bg-background border px-1.5 py-0.5 rounded shrink-0">{log.action}</span>
              <span className="text-muted-foreground flex-1 min-w-0 truncate">
                {log.entityType} · {log.entityId.slice(0, 12)}…
                {' · '}
                {log.actor ? `${log.actor.name} (${log.actor.email})` : 'Система'}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(log.createdAt).toLocaleString('ru')}</span>
            </div>
          ))}
          {!data?.items.length && <p className="text-center py-8 text-muted-foreground">Лог пуст</p>}
          <Pager page={data?.page ?? 1} pages={data?.pages ?? 1} onChange={setPage} />
        </div>
      )}
    </div>
  )
}

function VenuesTab() {
  const { data: venues, isLoading } = useQuery({
    queryKey: ['admin-venues'],
    queryFn: () => api.venues.list({ perPage: 100 } as Parameters<typeof api.venues.list>[0]),
  })

  return isLoading ? (
    <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
  ) : (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link href="/admin/venues/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />Добавить заведение</Button>
        </Link>
      </div>
      {venues?.items.map(v => (
        <Card key={v.id}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium truncate">{v.name}</p>
              <p className="text-xs text-muted-foreground">{v.address} · {v.category.nameRu}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={v.contentStatus === 'PUBLISHED' ? 'default' : 'secondary'} className="text-xs">
                {v.contentStatus}
              </Badge>
              {v.isFeatured && <Badge className="bg-amber-500 text-xs">Featured</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
      {!venues?.items.length && <p className="text-center py-8 text-muted-foreground">Нет заведений</p>}
    </div>
  )
}

// Реальная аналитика платформы с графиками (правка #25)
const ANALYTICS_PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const STATUS_RU: Record<string, string> = {
  PENDING: 'Ожидают', CONFIRMED: 'Подтверждены', COMPLETED: 'Завершены',
  REJECTED: 'Отклонены', AUTO_REJECTED: 'Авто-отклонены', CANCELLED: 'Отменены',
  NO_SHOW: 'Неявки', SLOT_TAKEN: 'Место занято',
}

function AnalyticsTab({ metrics }: { metrics?: ApiPlatformMetrics }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-platform-analytics'],
    queryFn: () => api.analytics.platform(),
  })

  const statusData = data
    ? Object.entries(data.byStatus).map(([status, count]) => ({ name: STATUS_RU[status] ?? status, value: count }))
    : []

  return (
    <div className="space-y-6">
      {/* KPI-карточки сверху */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Броней сегодня</p><p className="text-3xl font-bold mt-1">{metrics?.bookingsToday ?? '—'}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Выручка за месяц</p><p className="text-3xl font-bold mt-1">{metrics ? `${(metrics.revenueThisMonth / 1000).toFixed(0)}k ₸` : '—'}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Пользователей</p><p className="text-3xl font-bold mt-1">{metrics?.userCount ?? '—'}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Активных мерчантов</p><p className="text-3xl font-bold mt-1">{metrics?.merchants.ACTIVE ?? '—'}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Конверсия (заявка→бронь)</p><p className="text-3xl font-bold mt-1">{data ? `${data.conversionRate}%` : '—'}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Доля неявок</p><p className="text-3xl font-bold mt-1">{data ? `${data.noShowRate}%` : '—'}</p></CardContent></Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : !data || data.total === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Пока нет данных для аналитики за период.</CardContent></Card>
      ) : (
        <>
          {/* Динамика броней и выручки по дням */}
          <Card>
            <CardContent className="p-5">
              <p className="font-semibold mb-3 text-sm">Динамика броней и выручки по дням</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" fontSize={11} tickFormatter={d => d.slice(5)} />
                  <YAxis yAxisId="left" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} />
                  <Tooltip />
                  <Line yAxisId="left" type="monotone" dataKey="count" name="Броней" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" name="Выручка ₸" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Топ заведений по бронам */}
            <Card>
              <CardContent className="p-5">
                <p className="font-semibold mb-3 text-sm">Топ заведений по бронам</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.topByBookings} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" name="Броней" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Разбивка по статусам */}
            <Card>
              <CardContent className="p-5">
                <p className="font-semibold mb-3 text-sm">Брони по статусам</p>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {statusData.map((_, i) => <Cell key={i} fill={ANALYTICS_PIE_COLORS[i % ANALYTICS_PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// Управление промо-баннерами главной (создать/изменить/вкл-выкл/удалить, порядок)
function BannersTab() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ApiPromoBanner | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => api.promoBanners.listAll(),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.promoBanners.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.promoBanners.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-banners'] }); toast.success('Баннер удалён') },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Баннеры показываются на главной. Активные — по возрастанию «порядка».</p>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Добавить баннер</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : (
        <div className="space-y-2">
          {data?.map(b => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                {b.imageUrl && (
                  <img src={b.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{b.title}</span>
                    <Badge variant="secondary" className="text-xs">порядок {b.sortOrder}</Badge>
                    {!b.isActive && <Badge variant="outline" className="text-xs">выключен</Badge>}
                  </div>
                  {b.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.subtitle}</p>}
                  {b.ctaLabel && <p className="text-xs text-muted-foreground mt-0.5 truncate">Кнопка: «{b.ctaLabel}» → {b.ctaUrl || '—'}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ id: b.id, isActive: !b.isActive })} disabled={toggleMut.isPending}>
                    {b.isActive ? 'Выключить' : 'Включить'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(b)}>Изменить</Button>
                  <ConfirmButton
                    size="sm" variant="ghost" className="text-destructive"
                    title="Удалить баннер?"
                    description="Баннер будет удалён с главной. Действие необратимо."
                    confirmLabel="Удалить"
                    onConfirm={() => deleteMut.mutate(b.id)}
                  >
                    Удалить
                  </ConfirmButton>
                </div>
              </CardContent>
            </Card>
          ))}
          {!data?.length && <p className="text-center py-8 text-muted-foreground">Баннеров пока нет</p>}
        </div>
      )}

      {(creating || editing) && (
        <BannerFormDialog banner={editing} onClose={() => { setCreating(false); setEditing(null) }} />
      )}
    </div>
  )
}

function BannerFormDialog({ banner, onClose }: { banner: ApiPromoBanner | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: banner?.title ?? '',
    subtitle: banner?.subtitle ?? '',
    ctaLabel: banner?.ctaLabel ?? '',
    ctaUrl: banner?.ctaUrl ?? '',
    imageUrl: banner?.imageUrl ?? '',
    isActive: banner?.isActive ?? true,
    sortOrder: String(banner?.sortOrder ?? 0),
  })

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        ctaLabel: form.ctaLabel.trim() || null,
        ctaUrl: form.ctaUrl.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      }
      return banner ? api.promoBanners.update(banner.id, payload) : api.promoBanners.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] })
      toast.success(banner ? 'Баннер обновлён' : 'Баннер создан')
      onClose()
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{banner ? 'Изменить баннер' : 'Новый баннер'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Заголовок *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" placeholder="В топе недели · «Знак качества»" />
          </div>
          <div>
            <Label className="text-xs">Подзаголовок</Label>
            <Textarea rows={2} value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className="mt-1" placeholder="Проверенные спа и бани Астаны — скидки до 20%" />
          </div>
          <div>
            <Label className="text-xs">Картинка баннера (необязательно)</Label>
            <div className="mt-1">
              <PhotoUploadField
                value={form.imageUrl ? [form.imageUrl] : []}
                onChange={urls => setForm(f => ({ ...f, imageUrl: urls[0] ?? '' }))}
                folder="banners"
                max={1}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Текст кнопки</Label>
              <Input value={form.ctaLabel} onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))} className="mt-1" placeholder="Смотреть" />
            </div>
            <div>
              <Label className="text-xs">Ссылка кнопки</Label>
              <Input value={form.ctaUrl} onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))} className="mt-1" placeholder="/venues?category=bath" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs">Порядок (меньше — выше)</Label>
              <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} className="mt-1" />
            </div>
            <label className="flex items-center gap-2 text-sm h-9">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="accent-primary h-4 w-4" />
              Показывать на главной
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.title.trim()}>
            {mut.isPending ? 'Сохраняем...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdminContent() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
    if (!authLoading && user && user.role !== 'super_admin') router.push('/')
  }, [user, authLoading, router])

  const { data: metrics, isLoading: metricsLoading, refetch } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => api.admin.metrics(),
    enabled: !!user && user.role === 'super_admin',
    refetchInterval: 60_000,
  })

  const { data: pendingModeration } = useQuery({
    queryKey: ['admin-moderation', 'PENDING'],
    queryFn: () => api.moderation.list({ status: 'PENDING' }),
    enabled: !!user && user.role === 'super_admin',
    refetchInterval: 60_000,
  })

  // Управляемые вкладки — чтобы карточки-метрики могли переключать разделы (правка 19)
  const [tab, setTab] = useState('moderation')

  if (authLoading || !user) return null

  const cards = [
    { icon: <Building2 className="h-7 w-7 text-primary opacity-70" />, value: metrics?.merchants.ACTIVE ?? '—', label: 'Активных мерчантов', sub: metrics ? `${metrics.merchants.PENDING} ожидают` : '', tab: 'merchants' },
    { icon: <Calendar className="h-7 w-7 text-primary opacity-70" />, value: metrics?.bookingsToday ?? '—', label: 'Броней сегодня', tab: 'analytics' },
    { icon: <Users className="h-7 w-7 text-primary opacity-70" />, value: metrics?.userCount ?? '—', label: 'Пользователей', tab: 'users' },
    { icon: <TrendingUp className="h-7 w-7 text-primary opacity-70" />, value: metrics ? `${(metrics.revenueThisMonth / 1000).toFixed(0)}k ₸` : '—', label: 'Выручка за месяц', tab: 'analytics' },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Панель администратора</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Обновить
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.map((card, i) => (
          <Card
            key={i}
            className={card.tab ? 'cursor-pointer transition-shadow hover:shadow-md hover:border-primary/40' : ''}
            onClick={card.tab ? () => setTab(card.tab!) : undefined}
          >
            <CardContent className="p-4 flex items-center gap-3">
              {card.icon}
              <div>
                {metricsLoading ? <Skeleton className="h-7 w-12 mb-1" /> : <p className="text-2xl font-bold">{card.value}</p>}
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {metrics && metrics.merchants.PENDING > 0 && (
        <div className="mb-6 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center gap-2 text-sm text-yellow-800">
          <ShieldOff className="h-4 w-4 shrink-0" />
          <span><strong>{metrics.merchants.PENDING}</strong> мерчантов ожидают активации</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="moderation" className="gap-2">
            Модерация
            {!!pendingModeration?.total && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold leading-none">
                {pendingModeration.total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="merchants" className="gap-2">
            Мерчанты
            {!!metrics?.merchants.PENDING && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold leading-none">
                {metrics.merchants.PENDING}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="venues">Заведения</TabsTrigger>
          <TabsTrigger value="banners">Баннеры</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="audit">Аудит</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>
        <TabsContent value="moderation"><ModerationTab /></TabsContent>
        <TabsContent value="merchants"><MerchantsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="venues"><VenuesTab /></TabsContent>
        <TabsContent value="banners"><BannersTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab metrics={metrics} /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
        <TabsContent value="settings"><div className="max-w-2xl space-y-4"><ChangePasswordCard /><AppearanceCard /><LogoutCard /></div></TabsContent>
      </Tabs>
    </div>
  )
}

export default function AdminPage() {
  return <Suspense><AdminContent /></Suspense>
}

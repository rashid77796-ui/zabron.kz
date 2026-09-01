'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ApiModerationRequest } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { isVideo } from '@/lib/media'
import type { Bathhouse } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { CollapsibleMap } from '@/components/CollapsibleMap'
import { LogoutCard } from '@/components/LogoutCard'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock, MapPin, Building2, User, Phone, FileText, ImageOff, RotateCcw, AlertTriangle, Star } from 'lucide-react'

const BathhouseMap = dynamic(() => import('@/components/BathhouseMap'), { ssr: false })

// Дни недели для показа рабочего времени (0 = воскресенье)
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// Пометка «изменено» рядом с полем, которое владелец поменял (правка: видимость изменений)
function ChangedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
      <Star className="h-2.5 w-2.5 fill-current" />изменено
    </span>
  )
}

// Статусы модерации (правка #22: добавлен NEEDS_REVISION)
type ModStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION'

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  NEEDS_REVISION: 'outline',
}

const STATUS_LABEL: Record<ModStatus, string> = {
  PENDING: 'На проверке',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
  NEEDS_REVISION: 'На доработке',
}

const FILTER_LABEL: Record<ModStatus, string> = {
  PENDING: 'На проверке',
  APPROVED: 'Одобренные',
  REJECTED: 'Отклонённые',
  NEEDS_REVISION: 'На доработке',
}

// Строка diff «было → стало» (правка #23)
function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="space-y-0.5">
      <p className="font-medium text-amber-900">{label}</p>
      <p className="text-muted-foreground line-through whitespace-pre-wrap">{before || '—'}</p>
      <p className="text-foreground whitespace-pre-wrap">{after || '—'}</p>
    </div>
  )
}

function ModerationCard({
  req,
  onApprove,
  onReject,
  onRevise,
  isLoading,
}: {
  req: ApiModerationRequest
  onApprove: (id: string) => void
  onReject: (id: string, note: string) => void
  onRevise: (id: string, note: string) => void
  isLoading: boolean
}) {
  const [rejectNote, setRejectNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reviseNote, setReviseNote] = useState('')
  const [showReviseForm, setShowReviseForm] = useState(false)

  // diff показываем только для правок уже опубликованного заведения (правка #23);
  // для первичной публикации currentContent == предложенному, поэтому diff не показываем.
  const cur = req.currentContent
  const isEdit = req.venue?.contentStatus === 'PUBLISHED' && !!cur
  const nameChanged = isEdit && cur!.name !== req.venue!.name
  const descChanged = isEdit && cur!.description !== req.venue!.description
  const photosChanged = isEdit && JSON.stringify(cur!.photos) !== JSON.stringify(req.venue!.photos)
  const hasDiff = nameChanged || descChanged || photosChanged

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold">
                {req.venue?.name ?? req.entityType} #{req.entityId.slice(0, 8)}
              </span>
              {nameChanged && <ChangedBadge />}
              <Badge variant={STATUS_COLORS[req.status] ?? 'secondary'} className="text-xs">
                {STATUS_LABEL[req.status as ModStatus] ?? req.status}
              </Badge>
              <Badge variant="outline" className="text-xs">{req.entityType}</Badge>
              {isEdit && <Badge variant="outline" className="text-xs">Правка опубликованного</Badge>}
            </div>

            {req.venue && (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{req.venue.address}
                </div>
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />{req.venue.category.nameRu}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />{req.venue.merchant.owner.name} · {req.venue.merchant.owner.email}
                </div>
                {req.venue.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />{req.venue.phone}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(req.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>

          {req.status === 'PENDING' && !showRejectForm && !showReviseForm && (
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <Button size="sm" onClick={() => onApprove(req.id)} disabled={isLoading}>
                <CheckCircle className="h-4 w-4 mr-1" />Одобрить
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReviseForm(true)} disabled={isLoading}>
                <RotateCcw className="h-4 w-4 mr-1" />На доработку
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setShowRejectForm(true)} disabled={isLoading}>
                <XCircle className="h-4 w-4 mr-1" />Отклонить
              </Button>
            </div>
          )}
        </div>

        {/* Что заведение НЕ заполнило — видно модератору сразу (правка: полнота заявки) */}
        {req.venue && (() => {
          const gaps: string[] = []
          if (!req.venue.resources?.length) gaps.push('ресурсы (кабинки / столы / зоны)')
          if (!req.venue.hours?.length) gaps.push('рабочее время')
          if (!req.venue.photos?.length) gaps.push('фотографии')
          if (!req.venue.description?.trim()) gaps.push('описание')
          if (gaps.length === 0) return null
          return (
            <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs">
              <p className="flex items-center gap-1 font-medium text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />Заведение заполнило не всё:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-700/90">
                {gaps.map(g => <li key={g}>Не указано: {g}</li>)}
              </ul>
            </div>
          )
        })()}

        {/* Diff «было → стало» для правок опубликованного заведения (правка #23) */}
        {hasDiff && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs space-y-2">
            <p className="font-medium text-amber-900">Что изменил владелец (было → стало):</p>
            {nameChanged && <DiffRow label="Название" before={cur!.name} after={req.venue!.name} />}
            {descChanged && <DiffRow label="Описание" before={cur!.description} after={req.venue!.description} />}
            {photosChanged && (
              <p className="text-amber-900">Фотографии изменены: было {cur!.photos.length} → стало {req.venue!.photos.length}</p>
            )}
          </div>
        )}

        {req.venue && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {/* Фотографии / видео */}
            {photosChanged && (
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Фотографии <ChangedBadge />
              </div>
            )}
            {req.venue.photos.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {req.venue.photos.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-28 w-40 shrink-0 rounded-lg overflow-hidden border bg-muted"
                  >
                    {isVideo(src) ? (
                      <video src={src} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={src} alt={`Фото ${i + 1}`} className="h-full w-full object-cover" />
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ImageOff className="h-3.5 w-3.5" />Фотографии не добавлены
              </div>
            )}

            {/* Описание */}
            {req.venue.description && (
              <div className="text-sm">
                <div className="flex items-center gap-1 mb-1 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3 w-3" />Описание
                  {descChanged && <ChangedBadge />}
                </div>
                <p className="whitespace-pre-wrap text-foreground/90">{req.venue.description}</p>
              </div>
            )}

            {/* Ресурсы и рабочее время — чтобы модератор видел полноту заявки */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="text-sm">
                <div className="flex items-center gap-1 mb-1 text-xs font-medium text-muted-foreground">
                  <Building2 className="h-3 w-3" />Ресурсы ({req.venue.resources?.length ?? 0})
                </div>
                {req.venue.resources?.length ? (
                  <ul className="space-y-0.5 text-foreground/90">
                    {req.venue.resources.map(r => (
                      <li key={r.id}>• {r.name} — до {r.capacity} чел.</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-red-600">Не добавлены</p>
                )}
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1 mb-1 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" />Рабочее время
                </div>
                {req.venue.hours?.length ? (
                  <ul className="space-y-0.5 text-foreground/90">
                    {req.venue.hours.map(h => (
                      <li key={h.id}>{WEEKDAYS[h.dayOfWeek]}: {h.openTime}–{h.closeTime}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-red-600">Не указано</p>
                )}
              </div>
            </div>

            {/* Карта */}
            {req.venue.lat && req.venue.lng ? (
              <div>
                <div className="flex items-center gap-1 mb-1 text-xs font-medium text-muted-foreground">
                  <MapPin className="h-3 w-3" />Расположение на карте · {req.venue.lat.toFixed(5)}, {req.venue.lng.toFixed(5)}
                </div>
                <CollapsibleMap label="Показать карту" hideLabel="Скрыть карту">
                  <BathhouseMap
                    bathhouses={[{
                      id: req.venue.id,
                      ownerId: '',
                      name: req.venue.name,
                      address: req.venue.address,
                      description: req.venue.description,
                      photos: req.venue.photos,
                      lat: req.venue.lat,
                      lng: req.venue.lng,
                      phone: req.venue.phone ?? undefined,
                    } as Bathhouse]}
                    selectedId={req.venue.id}
                  />
                </CollapsibleMap>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />Координаты не указаны
              </div>
            )}
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

        {showReviseForm && (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Что нужно исправить владельцу (обязательно). Заведение вернётся на доработку."
              value={reviseNote}
              onChange={e => setReviseNote(e.target.value)}
              className="text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => { onRevise(req.id, reviseNote); setShowReviseForm(false) }}
                disabled={!reviseNote.trim() || isLoading}
              >
                Отправить на доработку
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowReviseForm(false); setReviseNote('') }}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {req.note && (
          <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground">
            Комментарий: {req.note}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ModeratorContent() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<ModStatus>('PENDING')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
    if (!authLoading && user && user.role !== 'moderator' && user.role !== 'super_admin') router.push('/')
  }, [user, authLoading, router])

  const { data, isLoading } = useQuery({
    queryKey: ['moderation', statusFilter, page],
    queryFn: () => api.moderation.list({ status: statusFilter, page }),
    enabled: !!user,
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.moderation.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation'] })
      toast.success('Заведение опубликовано')
    },
    onError: () => toast.error('Ошибка при одобрении'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.moderation.reject(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation'] })
      toast.success('Заявка отклонена')
    },
    onError: () => toast.error('Ошибка при отклонении'),
  })

  const reviseMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.moderation.revise(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation'] })
      toast.success('Отправлено на доработку')
    },
    onError: () => toast.error('Ошибка при отправке на доработку'),
  })

  if (authLoading || !user) return null

  const items = data?.items ?? []
  const setFilter = (s: ModStatus) => { setStatusFilter(s); setPage(1) }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Модерация контента</h1>
        {data && <p className="text-muted-foreground mt-1">Всего: {data.total}</p>}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(['PENDING', 'NEEDS_REVISION', 'APPROVED', 'REJECTED'] as const).map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {FILTER_LABEL[s]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p>Нет заявок со статусом «{STATUS_LABEL[statusFilter]}»</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {items.map((req) => (
              <ModerationCard
                key={req.id}
                req={req}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id, note) => rejectMutation.mutate({ id, note })}
                onRevise={(id, note) => reviseMutation.mutate({ id, note })}
                isLoading={approveMutation.isPending || rejectMutation.isPending || reviseMutation.isPending}
              />
            ))}
          </div>

          {/* Пагинация (правка #24) */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                ‹ Назад
              </Button>
              <span className="text-sm text-muted-foreground">{data.page} / {data.pages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
                Вперёд ›
              </Button>
            </div>
          )}
        </>
      )}

      {/* У модератора нет вкладки настроек, а выход из шапки убран — кладём
          карточку в конец страницы, это его единственный кабинет. */}
      <div className="mt-8 max-w-2xl">
        <LogoutCard />
      </div>
    </div>
  )
}

export default function ModeratorPage() {
  return (
    <Suspense>
      <ModeratorContent />
    </Suspense>
  )
}

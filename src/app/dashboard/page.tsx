'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ApiReferralStats, type ApiReviewFull } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ChangePasswordCard } from '@/components/ChangePasswordCard'
import { AppearanceCard } from '@/components/AppearanceCard'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LogoutCard } from '@/components/LogoutCard'
import { Calendar, Users, Clock, X, Heart, MapPin, Star, Bell, BellOff, Clock3, Gift, Copy, Check, Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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

function DataPrivacyCard({ userId, onLogout }: { userId?: string; onLogout: () => void }) {
  const [delConfirm, setDelConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await api.profile.export()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zabron-data-${userId ?? 'me'}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Не удалось экспортировать данные')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.profile.delete()
      toast.success('Аккаунт удалён')
      onLogout()
    } catch {
      toast.error('Не удалось удалить аккаунт')
      setDeleting(false)
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardContent className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">Ваши данные</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={exporting}
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Экспорт...' : 'Скачать мои данные'}
          </Button>
          {!delConfirm ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => setDelConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить аккаунт
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-destructive font-medium">Подтвердить удаление?</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Удаляем...' : 'Да, удалить'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setDelConfirm(false)}
              >
                Отмена
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Экспорт включает бронирования, отзывы, избранное и историю уведомлений. Удаление аккаунта необратимо — все данные будут стёрты (Закон РК «О персональных данных»).
        </p>
      </CardContent>
    </Card>
  )
}

function DashboardContent() {
  const { user, isLoading: authLoading, logout, refreshUser } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Гостя отправляем на вход наравне с неавторизованным: сессия у него есть,
  // но в кабинете нечего показывать — имени нет, email служебный
  // на @anon.zabron.kz. Из навигации профиль ему уже скрыт, это защита от
  // перехода по прямой ссылке.
  const isGuest = !user || user.isAnonymous

  useEffect(() => {
    if (!authLoading && isGuest) router.push('/auth')
  }, [isGuest, authLoading, router])

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.bookings.myBookings(),
    enabled: !!user,
  })

  const { data: favorites, isLoading: favsLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: api.favorites.list,
    enabled: !!user,
  })

  const { data: waitlist, isLoading: waitlistLoading } = useQuery({
    queryKey: ['waitlist'],
    queryFn: api.waitlist.list,
    enabled: !!user,
  })

  const { data: telegramLink } = useQuery({
    queryKey: ['telegram-link'],
    queryFn: api.telegram.getLink,
    enabled: !!user,
  })

  const { data: referral } = useQuery<ApiReferralStats>({
    queryKey: ['referral'],
    queryFn: api.referrals.my,
    enabled: !!user,
  })

  const { data: myReviews } = useQuery<ApiReviewFull[]>({
    queryKey: ['my-reviews'],
    queryFn: api.reviews.myReviews,
    enabled: !!user,
  })

  const [copied, setCopied] = useState(false)
  const referralUrl = typeof window !== 'undefined' && referral?.code
    ? `${window.location.origin}/auth?ref=${referral.code}`
    : ''

  const handleCopyReferral = () => {
    if (!referralUrl) return
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const waitlistLeaveMutation = useMutation({
    mutationFn: (id: string) => api.waitlist.leave(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waitlist'] }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.bookings.action(id, 'cancel'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
    onError: (e: Error) => {
      if (e.message === 'CANCEL_TOO_LATE') toast.error('Отмена невозможна', { description: 'Слишком поздно отменять эту бронь по правилам заведения' })
      else toast.error('Не удалось отменить бронь')
    },
  })

  const favMutation = useMutation({
    mutationFn: (venueId: string) => api.favorites.toggle(venueId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const [profileForm, setProfileForm] = useState({ name: '', phone: '' })
  useEffect(() => {
    if (user) setProfileForm({ name: user.name ?? '', phone: (user as { phone?: string }).phone ?? '' })
  }, [user?.id])

  const profileMutation = useMutation({
    mutationFn: () => api.profile.update({ name: profileForm.name || undefined, phone: profileForm.phone || undefined }),
    onSuccess: (updated) => {
      // Обновляем сессию, иначе приветствие/форма показывают старые данные до
      // жёсткой перезагрузки (кажется, что «не сохранилось»).
      refreshUser()
      setProfileForm({ name: updated.name ?? '', phone: updated.phone ?? '' })
      toast.success('Профиль обновлён')
    },
    onError: (e: Error) => toast.error('Ошибка', { description: e.message }),
  })

  // Скелет держим и на время редиректа гостя — иначе кабинет успеет мигнуть.
  if (authLoading || isGuest) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
      </div>
    )
  }

  const active = bookings?.filter(b => ['PENDING', 'CONFIRMED'].includes(b.status)) ?? []
  const past = bookings?.filter(b => !['PENDING', 'CONFIRMED'].includes(b.status)) ?? []

  // По каким бронам/заведениям уже есть отзыв — чтобы скрыть кнопку «Оставить отзыв» (правка #13)
  const hasReviewFor = (b: { id: string; resource: { venue: { id: string } } }) =>
    (myReviews ?? []).some(r => r.bookingId === b.id || (r.bookingId == null && r.venueId === b.resource.venue.id))

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Добро пожаловать, {user.name}</h1>
        <p className="text-muted-foreground mt-1">{user.email}</p>
      </div>

      <Tabs defaultValue="bookings">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="bookings">
            Брони
            {active.length > 0 && (
              <Badge className="ml-2 h-5 min-w-5 px-1 text-xs">{active.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="favorites">
            Избранное
            {(favorites?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">{favorites?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="waitlist">
            Очередь
            {(waitlist?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">{waitlist?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviews">
            Отзывы
            {(myReviews?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">{myReviews!.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="referral">Рефералы</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-4">
                Активные заявки
                {active.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({active.length} из 3)</span>
                )}
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
                </div>
              ) : active.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Нет активных заявок</p>
                    <Link href="/venues">
                      <Button variant="link" className="mt-2">Найти заведение</Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {active.map(b => {
                    const s = STATUS_LABELS[b.status] ?? { label: b.status, variant: 'secondary' as const }
                    const start = new Date(b.startAt)
                    const end = new Date(b.endAt)
                    return (
                      <Card key={b.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">{b.resource.venue.name}</h3>
                                <Badge variant={s.variant} className="shrink-0 text-xs">{s.label}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{b.resource.name}</p>
                              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–{end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />{b.guests} чел.
                                </span>
                              </div>
                            </div>
                            {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                              <ConfirmButton
                                variant="ghost"
                                size="sm"
                                className="shrink-0 text-destructive hover:text-destructive"
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
                            )}
                          </div>
                          {b.checkInCode && b.status === 'CONFIRMED' && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-muted-foreground">Код для входа</p>
                              <p className="font-mono font-bold text-lg tracking-widest">{b.checkInCode}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">История</h2>
                <div className="space-y-3">
                  {past.slice(0, 5).map(b => {
                    const s = STATUS_LABELS[b.status] ?? { label: b.status, variant: 'secondary' as const }
                    const start = new Date(b.startAt)
                    return (
                      <Card key={b.id} className="opacity-75">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-sm">{b.resource.venue.name} — {b.resource.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {b.status === 'COMPLETED' && !hasReviewFor(b) && (
                                <Link href={`/venues/${b.resource.venue.id}?review=${b.id}`}>
                                  <Button variant="outline" size="sm" className="h-7 text-xs">
                                    <Star className="h-3.5 w-3.5 mr-1" />Оставить отзыв
                                  </Button>
                                </Link>
                              )}
                              <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {past.length > 5 && (
                    <Link href="/bookings">
                      <Button variant="link" className="pl-0">Все брони ({past.length})</Button>
                    </Link>
                  )}
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="favorites">
          {favsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : !favorites?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Heart className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>Избранных заведений нет</p>
                <Link href="/venues">
                  <Button variant="link" className="mt-2">Найти заведение</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            // Авто-подборки: группируем избранное по категориям (правка #56)
            <div className="space-y-6">
              {(() => {
                const groups = new Map<string, { name: string; items: typeof favorites }>()
                for (const f of favorites) {
                  const key = f.venue.category.id
                  if (!groups.has(key)) groups.set(key, { name: f.venue.category.nameRu, items: [] })
                  groups.get(key)!.items.push(f)
                }
                return [...groups.values()]
                  .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                  .map(g => (
                    <div key={g.name}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        {g.name}
                        <span className="text-xs font-normal text-muted-foreground">{g.items.length}</span>
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {g.items.map(fav => {
                          const v = fav.venue
                          const avgRating = v.reviews.length
                            ? Math.round((v.reviews.reduce((s, r) => s + r.rating, 0) / v.reviews.length) * 10) / 10
                            : null
                          return (
                            <Card key={fav.id} className="overflow-hidden">
                              <Link href={`/venues/${v.id}`}>
                                {v.photos[0] ? (
                                  <img src={v.photos[0]} alt={v.name} className="h-36 w-full object-cover" />
                                ) : (
                                  <div className="h-36 w-full bg-muted flex items-center justify-center">
                                    <Heart className="h-10 w-10 text-muted-foreground/20" />
                                  </div>
                                )}
                              </Link>
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <Link href={`/venues/${v.id}`}>
                                      <p className="font-semibold text-sm truncate hover:underline">{v.name}</p>
                                    </Link>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                      <MapPin className="h-3 w-3" />{v.address}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="secondary" className="text-xs">{v.category.nameRu}</Badge>
                                      {avgRating != null && (
                                        <span className="flex items-center gap-0.5 text-xs text-amber-500">
                                          <Star className="h-3 w-3 fill-current" />{avgRating}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => favMutation.mutate(v.id)}
                                    disabled={favMutation.isPending}
                                    className="shrink-0 p-1 rounded-full hover:bg-accent"
                                  >
                                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                                  </button>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  ))
              })()}
            </div>
          )}
        </TabsContent>
        {/* Waitlist Tab */}
        <TabsContent value="waitlist">
          {waitlistLoading ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          ) : !waitlist?.length ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Clock3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Вы не стоите в очереди ни на один ресурс</p>
                <p className="text-xs mt-1">Когда занятый слот освободится — придёт уведомление</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {waitlist.map(entry => (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-sm">{entry.resource.venue.name} — {entry.resource.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Желаемое время: {new Date(entry.desiredStart).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.resource.venue.address}</p>
                      </div>
                      <Button
                        variant="ghost" size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => waitlistLeaveMutation.mutate(entry.id)}
                        disabled={waitlistLeaveMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          {!myReviews ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
          ) : myReviews.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Star className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>Вы ещё не оставили отзывов</p>
                <p className="text-xs mt-1">После завершённой брони можно оставить отзыв на странице заведения</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myReviews.map((r: ApiReviewFull) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        {r.venue && (
                          <Link href={`/venues/${r.venue.id}`} className="font-semibold hover:underline text-sm">
                            {r.venue.name}
                          </Link>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(r.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {r.text && <p className="text-sm text-muted-foreground">{r.text}</p>}
                    {r.photos.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {r.photos.map((src, i) => (
                          <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    {r.merchantResponse && (
                      <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Ответ заведения</p>
                        <p className="text-xs">{r.merchantResponse}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Referral Tab */}
        <TabsContent value="referral">
          <div className="space-y-4 max-w-lg">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Gift className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Пригласи друга</h3>
                    <p className="text-sm text-muted-foreground">Поделитесь ссылкой — оба получат бонус при регистрации</p>
                  </div>
                </div>

                {referral?.code ? (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Ваша реферальная ссылка</p>
                      <div className="flex gap-2">
                        <code className="flex-1 truncate bg-muted rounded-md px-3 py-2 text-sm font-mono">{referralUrl}</code>
                        <Button variant="outline" size="sm" onClick={handleCopyReferral} className="shrink-0 gap-1.5">
                          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? 'Скопировано' : 'Копировать'}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pt-2 border-t text-sm">
                      <div>
                        <p className="text-2xl font-bold">{referral.referredCount}</p>
                        <p className="text-xs text-muted-foreground">Приглашено</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{referral.rewardGranted ? '✅' : '—'}</p>
                        <p className="text-xs text-muted-foreground">Бонус получен</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    <p>Загрузка реферального кода...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm">Профиль</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="profile-name" className="text-xs">Имя</Label>
                    <Input
                      id="profile-name"
                      value={profileForm.name}
                      onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Label htmlFor="profile-phone" className="text-xs">Телефон</Label>
                      {(user as { isPhoneVerified?: boolean })?.isPhoneVerified && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-medium">
                          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="6" fill="currentColor" opacity=".15"/><path d="M3.5 6l2 2 3-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Подтверждён
                        </span>
                      )}
                    </div>
                    <PhoneInput
                      id="profile-phone"
                      value={profileForm.phone}
                      onChange={v => setProfileForm(f => ({ ...f, phone: v }))}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => profileMutation.mutate()}
                  disabled={profileMutation.isPending || !profileForm.name.trim()}
                >
                  {profileMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
                </Button>
              </CardContent>
            </Card>

            <ChangePasswordCard />

            <AppearanceCard />

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {telegramLink?.linked ? (
                    <Bell className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">Telegram-уведомления</h3>
                    {telegramLink?.linked ? (
                      <div className="mt-1">
                        <p className="text-xs text-green-700 font-medium">✅ Telegram привязан</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Уведомления о бронях приходят в Telegram. Чтобы отвязать — отправьте боту команду <code className="bg-muted px-1 rounded">/stop</code>
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Получайте уведомления о статусе броней прямо в Telegram.
                        </p>
                        {telegramLink?.url ? (
                          <a href={telegramLink.url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <Bell className="h-3.5 w-3.5" />
                              Привязать Telegram
                            </Button>
                          </a>
                        ) : (
                          <div className="text-xs text-muted-foreground bg-muted rounded-lg p-2">
                            <p className="font-medium mb-1">Ручная привязка:</p>
                            <p>1. Откройте бот Zabron в Telegram</p>
                            <p>2. Отправьте команду:</p>
                            <code className="block mt-1 bg-background rounded px-2 py-1 select-all font-mono">
                              /start {user?.id}
                            </code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <DataPrivacyCard userId={user?.id} onLogout={logout} />
            <LogoutCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  )
}

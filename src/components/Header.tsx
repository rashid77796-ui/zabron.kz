'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ApiNotification } from '@/lib/api'
import { toast } from 'sonner'
import { useI18n, type Locale } from '@/lib/i18n'
import type { User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { CitySelect } from '@/components/CitySelect'
import { isPushSupported, subscribePush } from '@/lib/push'
import { Logo } from '@/components/Logo'
import {
  User as UserIcon, Bell, BellOff, BellRing, ArrowLeft,
  CalendarCheck, Heart, Search, ChevronDown,
} from 'lucide-react'

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'ru', label: 'РУС' },
  { code: 'kk', label: 'ҚАЗ' },
  { code: 'en', label: 'ENG' },
]

// Локаль → тег форматирования дат (правка #30)
const LOCALE_BCP: Record<Locale, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' }

interface HeaderProps {
  user: User | null
  isImpersonating?: boolean
  onReturnToAdmin?: () => void
}

const Header = ({ user, isImpersonating, onReturnToAdmin }: HeaderProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [localeOpen, setLocaleOpen] = useState(false)

  const { data: notifications = [] } = useQuery<ApiNotification[]>({
    queryKey: ['notifications'],
    queryFn: api.notifications.list,
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  // Непрочитанные считаем по серверной отметке readAt — синхронно между устройствами (правка #31)
  const unreadCount = notifications.filter(n => !n.readAt).length

  // Значок-счётчик на иконке установленного приложения (Badging API). Ставится,
  // пока приложение открыто, и остаётся на ярлыке после закрытия. Работает на
  // установленном PWA (iOS 16.4+, десктоп Chrome/Edge; на Android — зависит от лаунчера).
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (!('setAppBadge' in navigator)) return
    if (unreadCount > 0) nav.setAppBadge?.(unreadCount).catch(() => {})
    else nav.clearAppBadge?.().catch(() => {})
  }, [unreadCount])

  const markReadMutation = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const handleMarkRead = () => {
    if (unreadCount > 0) markReadMutation.mutate()
  }

  // Разрешение на push браузер выдаёт только в ответ на жест пользователя —
  // вызов при загрузке страницы Chrome и Safari просто игнорируют. Поэтому
  // спрашиваем по кнопке в поповере колокола. 'unsupported' прячет её там,
  // где push недоступен (http-домен, Safari без установленной PWA).
  const [pushPerm, setPushPerm] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [pushLoading, setPushLoading] = useState(false)

  // Только на клиенте: на сервере Notification нет, а разное значение на
  // сервере и в первом рендере сломало бы гидратацию.
  useEffect(() => {
    if (isPushSupported()) setPushPerm(Notification.permission)
  }, [])

  const handleEnablePush = async () => {
    setPushLoading(true)
    const ok = await subscribePush(true)
    const perm = isPushSupported() ? Notification.permission : 'unsupported'
    setPushPerm(perm)
    setPushLoading(false)
    if (ok) toast.success(t.header.pushEnabled)
    else toast.error(perm === 'denied' ? t.header.pushBlocked : t.header.pushFailed)
  }

  // Анонимный гость — это «ещё не вошёл». Сессия у него есть (иначе некуда
  // писать брони и избранное), поэтому разделы и колокол ему показываем, но
  // в правом углу он должен видеть «Создать аккаунт», а не «Выйти»: выходить
  // ему некуда, а после signOut он тут же станет новым гостем.
  const isSignedIn = !!user && !user.isAnonymous

  const dashboardPath =
    user?.role === 'super_admin' ? '/admin'
    : user?.role === 'moderator' ? '/moderator'
    : user?.role === 'merchant' ? '/owner'
    : '/dashboard'

  // Компактный переключатель языка: в шапке видна текущая локаль, остальные — в поповере.
  const localeSwitcher = (
    <Popover open={localeOpen} onOpenChange={setLocaleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 px-2 text-sm font-normal">
          {LOCALES.find(l => l.code === locale)?.label}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-32 p-1">
        {LOCALES.map(l => (
          <button
            key={l.code}
            onClick={() => { setLocale(l.code); setLocaleOpen(false) }}
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
              locale === l.code ? 'font-semibold text-primary' : ''
            }`}
          >
            {l.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )

  return (
    <>
      {isImpersonating && (
        <div className="bg-yellow-500/90 text-yellow-950 text-sm text-center py-1.5 px-4 flex items-center justify-center gap-2 flex-wrap">
          <span>{t.header.impersonatingAs} <strong>{user?.name}</strong> ({user?.email})</span>
          <Button size="sm" variant="outline" onClick={onReturnToAdmin} className="h-7 gap-1 border-yellow-700 bg-yellow-400/50 hover:bg-yellow-400">
            <ArrowLeft className="h-3.5 w-3.5" />{t.header.returnToAdmin}
          </Button>
        </div>
      )}
      <header className="sticky top-0 z-50 bg-card sm:border-b">
        <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4">
          {/* Слева: лого + город */}
          <div className="flex min-w-0 items-center gap-1">
            <Link href="/" className="flex shrink-0 items-center" aria-label="Zabron">
              {/* На мобильных — только знак, чтобы освободить место городу и правой группе */}
              <Logo variant="mark" className="h-7 w-auto sm:hidden" priority />
              <Logo variant="wordmark" className="hidden h-7 w-auto sm:block" priority />
            </Link>
            <CitySelect />
          </div>

          {/* Справа: язык, поиск, разделы, вход */}
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {localeSwitcher}

            <Button
              variant="ghost" size="sm"
              aria-label={t.nav.search}
              title={t.nav.search}
              onClick={() => router.push('/venues')}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Десктоп: брони, избранное, профиль — на мобильных они в BottomNav */}
            {user && (
              <div className="hidden sm:flex items-center gap-1">
                <Link href={user.role === 'merchant' ? '/owner' : '/bookings'}>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <CalendarCheck className="h-4 w-4" />{t.nav.myBookings}
                  </Button>
                </Link>
                <Link href="/venues?fav=1">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Heart className="h-4 w-4" />{t.nav.favorites}
                  </Button>
                </Link>
                {/* Профиль гостю не показываем: редактировать там нечего —
                    имени нет, email служебный на @anon.zabron.kz. Брони и
                    избранное оставляем, их гость заводит наравне со всеми. */}
                {isSignedIn && (
                  <Link href={dashboardPath}>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <UserIcon className="h-4 w-4" />{t.nav.profile}
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {/* Колокол уведомлений — доступен на всех размерах */}
            {user && (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative gap-1.5">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <span className="font-semibold text-sm">{t.header.notifications}</span>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkRead}>
                        {t.header.markAllRead}
                      </Button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">{t.header.noNotifications}</p>
                    ) : (
                      notifications.slice(0, 20).map(n => {
                        const isUnread = !n.readAt
                        const bookingId = n.payload?.bookingId
                        return (
                          <button
                            key={n.id}
                            onClick={() => {
                              handleMarkRead()
                              setOpen(false)
                              router.push(dashboardPath + (bookingId ? `?booking=${bookingId}` : ''))
                            }}
                            className={`w-full text-left border-b px-4 py-3 text-sm transition-colors hover:bg-accent cursor-pointer ${isUnread ? 'bg-primary/5' : ''}`}
                          >
                            <p>{t.header.notif[n.type] ?? n.type}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(n.createdAt).toLocaleString(LOCALE_BCP[locale])}
                            </p>
                          </button>
                        )
                      })
                    )}
                  </div>
                  {pushPerm === 'default' && (
                    <button
                      onClick={handleEnablePush}
                      disabled={pushLoading}
                      className="flex w-full items-center gap-2 border-t px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent disabled:opacity-60"
                    >
                      <BellRing className="h-4 w-4 shrink-0" />
                      {t.header.enablePush}
                    </button>
                  )}
                  {pushPerm === 'denied' && (
                    <p className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
                      <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {t.header.pushBlocked}
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {/* Бургер-меню убрано: на мобильных вся навигация живёт в BottomNav,
                а установка приложения и тема — в настройках кабинета
                (AppearanceCard). Дублировать их в шапке было незачем. */}
            {!isSignedIn && (
              <Link href="/auth" className="hidden sm:block">
                <Button size="sm" className="gap-1.5">
                  <UserIcon className="h-4 w-4" />
                  {/* Гостю обещаем перенос его броней и избранного, а не «вход» */}
                  {user?.isAnonymous ? t.auth.guestUpgrade : t.nav.login}
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>
    </>
  )
}

export default Header

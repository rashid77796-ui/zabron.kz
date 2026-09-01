'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import type { User } from '@/lib/types'
import { Home, CalendarCheck, Heart, User as UserIcon, type LucideIcon } from 'lucide-react'

interface BottomNavProps {
  user: User | null
}

/**
 * Мобильная нижняя панель навигации: главная, брони, избранное, профиль.
 * Скрыта от sm и выше — там навигация живёт в шапке и в ленте категорий.
 */
export function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  const isFav = pathname === '/venues' && searchParams.get('fav') === '1'
  // Брони мерчанта живут в его кабинете, у остальных — в /bookings.
  const bookingsHref = user?.role === 'merchant' ? '/owner' : '/bookings'

  const items: { href: string; label: string; icon: LucideIcon; active: boolean }[] = [
    { href: '/', label: t.nav.home, icon: Home, active: pathname === '/' },
    {
      href: bookingsHref,
      label: t.nav.myBookings,
      icon: CalendarCheck,
      active: pathname.startsWith(bookingsHref),
    },
    { href: '/venues?fav=1', label: t.nav.favorites, icon: Heart, active: isFav },
    // Гостю вместо профиля — вход: у анонимной сессии нечего показывать в
    // кабинете, зато есть смысл предложить сохранить брони за собой.
    user && !user.isAnonymous
      ? {
          href: dashboardPath(user.role),
          label: t.nav.profile,
          icon: UserIcon,
          active: pathname.startsWith(dashboardPath(user.role)),
        }
      : { href: '/auth', label: t.nav.login, icon: UserIcon, active: pathname === '/auth' },
  ]

  return (
    <nav
      aria-label={t.nav.menu}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur-sm sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {items.map(({ href, label, icon: Icon, active }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium leading-none transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function dashboardPath(role: User['role']) {
  if (role === 'super_admin') return '/admin'
  if (role === 'moderator') return '/moderator'
  if (role === 'merchant') return '/owner'
  return '/dashboard'
}

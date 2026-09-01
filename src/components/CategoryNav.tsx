'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api, type ApiCategory } from '@/lib/api'
import { categoryIcon, sortCategories } from '@/lib/categories'
import { useI18n } from '@/lib/i18n'

/**
 * Липкая лента категорий под шапкой — ДЕСКТОПНАЯ раскладка (по образцу
 * десктопного kino.kz): чипы с иконками, активная — залитая.
 *
 * Только `≥ sm` и только на главной. На мобильных категории показывает
 * сеткой иконок [[CategoryGrid]] под слайдером. В каталоге (/venues) —
 * собственный фильтр, поэтому здесь он не дублируется.
 */
export function CategoryNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
    staleTime: 5 * 60_000,
  })

  if (pathname !== '/' || !categories || categories.length === 0) return null

  const active = searchParams.get('category')

  return (
    <div className="hidden sm:block">
      <div className="container mx-auto px-4">
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 py-2.5">
          <Chip href="/venues" label={t.nav.allCategories} active={!active} />
          {sortCategories(categories).map((cat: ApiCategory) => {
            const Icon = categoryIcon(cat.slug)
            return (
              <Chip
                key={cat.slug}
                href={`/venues?category=${cat.slug}`}
                label={cat.nameRu}
                active={active === cat.slug}
                icon={<Icon className="h-4 w-4" />}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Chip({
  href,
  label,
  active,
  icon,
}: {
  href: string
  label: string
  active: boolean
  icon?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}

'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api, type ApiCategory } from '@/lib/api'
import { categoryIcon, sortCategories } from '@/lib/categories'

/**
 * МОБИЛЬНАЯ раскладка категорий (по образцу мобильного kino.kz): сетка иконок
 * 3 в ряд — крупная контурная иконка в скруглённом квадрате + подпись снизу.
 * Живёт в потоке страницы под слайдером, не липкая. Только `< sm`.
 * Десктопный аналог — липкая чип-лента [[CategoryNav]].
 */
export function CategoryGrid() {
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
    staleTime: 5 * 60_000,
  })

  if (!categories || categories.length === 0) return null

  return (
    <section className="container mx-auto px-4 py-5 sm:hidden">
      <div className="grid grid-cols-3 gap-3">
        {sortCategories(categories).map((cat: ApiCategory) => {
          const Icon = categoryIcon(cat.slug)
          return (
            <Link
              key={cat.slug}
              href={`/venues?category=${cat.slug}`}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="flex h-16 w-full items-center justify-center rounded-2xl bg-accent text-primary transition-colors active:bg-primary/15">
                <Icon className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <span className="text-xs font-medium leading-tight text-foreground">
                {cat.nameRu}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

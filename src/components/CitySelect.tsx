'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Check } from 'lucide-react'

const CITIES = ['Астана', 'Алматы', 'Шымкент', 'Караганда', 'Актобе'] as const
const STORAGE_KEY = 'zabron_city'
const DEFAULT_CITY = 'Астана'

/**
 * Выбор города в шапке.
 *
 * ВНИМАНИЕ: на данный момент это только UI — в модели Venue нет поля city,
 * поэтому выбор сохраняется в localStorage, но НЕ фильтрует выдачу.
 * Чтобы город заработал, нужно добавить Venue.city в схему, отдавать его в API
 * и прокинуть в фильтры каталога.
 */
export function CitySelect() {
  const [city, setCity] = useState(DEFAULT_CITY)
  const [open, setOpen] = useState(false)

  // Читаем после монтирования — иначе SSR-разметка разойдётся с клиентской.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setCity(saved)
  }, [])

  const pick = (next: string) => {
    setCity(next)
    localStorage.setItem(STORAGE_KEY, next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 px-2 text-sm font-normal text-muted-foreground hover:text-foreground">
          {city}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {CITIES.map(c => (
          <button
            key={c}
            onClick={() => pick(c)}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            {c}
            {c === city && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

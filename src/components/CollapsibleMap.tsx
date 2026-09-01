'use client'

import { useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Сворачиваемая обёртка для карты (правка #55).
 * По умолчанию свёрнута — карта монтируется (и инициализирует Leaflet) только при раскрытии,
 * что заодно ускоряет первую загрузку. Для формы добавления заведения передаём defaultOpen.
 */
export function CollapsibleMap({
  children,
  defaultOpen = false,
  label = 'Показать на карте',
  hideLabel = 'Скрыть карту',
}: {
  children: React.ReactNode
  defaultOpen?: boolean
  label?: string
  hideLabel?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOpen(o => !o)}>
        <MapPin className="h-4 w-4" />
        {open ? hideLabel : label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

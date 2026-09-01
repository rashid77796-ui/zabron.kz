'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { computeVenueStatus, formatMinutesLeft, type VenueOpenStatus } from '@/lib/venueStatus'
import type { ApiVenueHours } from '@/lib/api'

/**
 * Бейдж статуса работы заведения (правка #54).
 * «Закроется через N» при ≤60 мин до закрытия, «Закрыто до завтра» / «Откроется в HH:MM»
 * когда закрыто. Когда открыто с запасом — ничего не показываем. Обновляется раз в минуту.
 */
export function VenueStatusBadge({
  hours,
  className,
}: {
  hours: ApiVenueHours[] | undefined | null
  className?: string
}) {
  const [status, setStatus] = useState<VenueOpenStatus>({ state: 'unknown' })

  useEffect(() => {
    const update = () => setStatus(computeVenueStatus(hours))
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [hours])

  if (status.state === 'open' || status.state === 'unknown') return null

  const base = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm ${className ?? ''}`

  if (status.state === 'closing_soon') {
    return (
      <span className={`${base} bg-amber-500 text-white`}>
        <Clock className="h-3 w-3" />
        Закроется через {formatMinutesLeft(status.minutesToClose)}
      </span>
    )
  }
  if (status.state === 'opens_later') {
    return (
      <span className={`${base} bg-zinc-700/85 text-white`}>
        <Clock className="h-3 w-3" />
        Откроется в {status.opensAt}
      </span>
    )
  }
  // closed
  return (
    <span className={`${base} bg-zinc-700/85 text-white`}>
      <Clock className="h-3 w-3" />
      Закрыто до завтра
    </span>
  )
}

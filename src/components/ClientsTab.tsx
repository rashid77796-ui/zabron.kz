'use client'

import { useMemo } from 'react'
import { type ApiBooking } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

interface ClientInfo {
  clientId: string
  clientName: string
  visitCount: number
  totalGuests: number
  lastVisitDate: string
  resources: string[]
}

const formatDate = (iso: string) => {
  const dt = new Date(iso)
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}

const ClientsTab = ({ bookings }: { bookings: ApiBooking[] }) => {
  const clients = useMemo(() => {
    const map = new Map<string, ClientInfo>()

    bookings.forEach(b => {
      const key = b.clientUserId ?? `guest:${b.guestName}:${b.guestPhone}`
      const displayName = b.client?.name ?? b.guestName ?? 'Гость'
      if (!b.client && !b.guestName) return
      const existing = map.get(key)
      const resourceName = b.resource.name

      if (existing) {
        existing.visitCount++
        existing.totalGuests += b.guests
        if (b.startAt > existing.lastVisitDate) existing.lastVisitDate = b.startAt
        if (!existing.resources.includes(resourceName)) existing.resources.push(resourceName)
      } else {
        map.set(key, {
          clientId: key,
          clientName: displayName,
          visitCount: 1,
          totalGuests: b.guests,
          lastVisitDate: b.startAt,
          resources: [resourceName],
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.lastVisitDate.localeCompare(a.lastVisitDate))
  }, [bookings])

  if (clients.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Пока нет клиентов</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>Всего уникальных клиентов: <strong className="text-foreground">{clients.length}</strong></span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Клиент</th>
              <th className="p-3">Визитов</th>
              <th className="p-3">Всего гостей</th>
              <th className="p-3">Последний визит</th>
              <th className="p-3">Ресурсы</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.clientId} className="border-b hover:bg-accent/30">
                <td className="p-3 font-medium">{c.clientName}</td>
                <td className="p-3">
                  <Badge variant={c.visitCount >= 3 ? 'default' : 'secondary'}>
                    {c.visitCount}
                  </Badge>
                </td>
                <td className="p-3">{c.totalGuests}</td>
                <td className="p-3">{formatDate(c.lastVisitDate)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {c.resources.map(name => (
                      <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ClientsTab

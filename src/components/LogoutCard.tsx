'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/useAuth'
import { LogOut } from 'lucide-react'

/**
 * Выход из аккаунта. Живёт в кабинете, а не в шапке: там кнопка путала гостей
 * (анонимной сессии выходить некуда) и занимала место. Кабинет у каждой роли
 * свой — /dashboard, /owner, /admin, /moderator, — поэтому карточка общая.
 */
export function LogoutCard() {
  const { user, logout } = useAuth()

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">Сеанс</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Вы вошли как {user?.email}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={logout}>
          <LogOut className="h-3.5 w-3.5" />
          Выйти
        </Button>
      </CardContent>
    </Card>
  )
}

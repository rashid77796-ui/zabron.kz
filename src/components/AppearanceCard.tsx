'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useInstallPrompt } from '@/components/InstallButton'

/**
 * Карточка «Внешний вид и приложение» для настроек всех кабинетов:
 * переключатель тёмной темы (правка #48) и установка PWA (правка #50).
 */
export function AppearanceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Внешний вид и приложение</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Тема оформления</p>
            <p className="text-xs text-muted-foreground">Светлая или тёмная — сохранится на этом устройстве</p>
          </div>
          <ThemeToggle withLabel />
        </div>
        <InstallBlock />
      </CardContent>
    </Card>
  )
}

/**
 * Блок установки приложения, «осведомлённый» о состоянии: рабочая кнопка когда
 * установка доступна, иначе — понятная инструкция (частая причина «кнопки нет» —
 * сайт открыт внутри мессенджера или в неподдерживающем браузере). Правка #50.
 */
function InstallBlock() {
  const { status, inApp, promptInstall, showIosHint } = useInstallPrompt()

  if (status === 'installed') {
    return (
      <div>
        <p className="text-sm font-medium">Приложение установлено ✓</p>
        <p className="text-xs text-muted-foreground">Zabron уже добавлен на устройство.</p>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Установить приложение</p>
        {status === 'available' && (
          <p className="text-xs text-muted-foreground">Ярлык на экране смартфона, работает как приложение.</p>
        )}
        {status === 'ios' && (
          <p className="text-xs text-muted-foreground">На iPhone: в Safari нажмите «Поделиться» → «На экран «Домой»».</p>
        )}
        {(status === 'unsupported' || status === 'pending') && (
          <p className="text-xs text-muted-foreground">
            {inApp
              ? 'Вы открыли сайт внутри мессенджера — установка тут недоступна. Откройте zabron.kz в Chrome (Android) или Safari (iPhone).'
              : 'Установка доступна в Chrome (Android) или Safari (iPhone). Откройте меню браузера ⋮ → «Установить приложение» / «На экран «Домой»».'}
          </p>
        )}
      </div>
      {status === 'available' && (
        <Button size="sm" variant="outline" onClick={() => promptInstall()} className="shrink-0 gap-2">
          <Download className="h-4 w-4" />Установить
        </Button>
      )}
      {status === 'ios' && (
        <Button size="sm" variant="outline" onClick={showIosHint} className="shrink-0 gap-2">
          <Download className="h-4 w-4" />Как установить
        </Button>
      )}
      {(status === 'unsupported' || status === 'pending') && !inApp && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-2"
          onClick={() =>
            toast('Установка Zabron на телефон', {
              description:
                'Chrome (Android): меню ⋮ вверху справа → «Установить приложение» (или «Добавить на главный экран» → «Установить»). iPhone (Safari): «Поделиться» → «На экран «Домой»».',
              duration: 9000,
            })
          }
        >
          <Download className="h-4 w-4" />Как установить
        </Button>
      )}
    </div>
  )
}

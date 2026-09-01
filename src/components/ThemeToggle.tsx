'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Переключатель тёмной темы (правка #48). Доступен во всех кабинетах через шапку.
 * Компактный вариант — иконка в шапке; вариант с подписью — для настроек.
 */
export function ThemeToggle({ withLabel = false, className }: { withLabel?: boolean; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // До монтирования тема неизвестна (SSR) — отдаём нейтральную заглушку, чтобы не мигало
  const isDark = mounted && resolvedTheme === 'dark'
  const toggle = () => setTheme(isDark ? 'light' : 'dark')

  if (withLabel) {
    return (
      <Button variant="outline" size="sm" onClick={toggle} className={`gap-2 ${className ?? ''}`} aria-label="Переключить тему">
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {isDark ? 'Светлая тема' : 'Тёмная тема'}
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className={className} aria-label="Переключить тему" title="Переключить тему">
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

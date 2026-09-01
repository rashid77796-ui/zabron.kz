'use client'

import { useEffect, useReducer, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { getDeferredPrompt, isAppInstalled, subscribeInstall, triggerInstall } from '@/lib/pwaInstall'

export type InstallStatus =
  | 'pending'      // ещё не определились (SSR / до монтирования)
  | 'available'    // Android/десктоп: пришло beforeinstallprompt — можно ставить
  | 'ios'          // iOS Safari: события нет, ставится вручную через «Поделиться»
  | 'installed'    // уже установлено / запущено как приложение
  | 'unsupported'  // браузер не поддерживает (в т.ч. встроенный браузер мессенджера)

/**
 * Состояние установки PWA (правки #16/#50). Читает событие из глобального
 * перехвата (`@/lib/pwaInstall`), поэтому кнопка работает, даже если
 * `beforeinstallprompt` пришёл ещё на главной, до открытия настроек.
 */
export function useInstallPrompt() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)
  const [mounted, setMounted] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [inApp, setInApp] = useState(false)

  useEffect(() => {
    setMounted(true)
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    )
    const ua = window.navigator.userAgent.toLowerCase()
    setIsIos(/iphone|ipad|ipod/.test(ua))
    // Встроенные браузеры мессенджеров/соцсетей не поддерживают установку PWA
    setInApp(/fban|fbav|instagram|line|micromessenger|telegram|tiktok|okhttp|gsa|vkandroid|miuibrowser/.test(ua))
    // Перерисовываемся, когда глобальный перехват поймал prompt / установку
    return subscribeInstall(forceUpdate)
  }, [])

  const installed = standalone || isAppInstalled()
  const hasPrompt = getDeferredPrompt() != null

  const status: InstallStatus = !mounted
    ? 'pending'
    : installed
      ? 'installed'
      : hasPrompt
        ? 'available'
        : isIos
          ? 'ios'
          : 'unsupported'

  const promptInstall = () => triggerInstall()

  const showIosHint = () =>
    toast('Установка на iPhone', {
      description: 'Нажмите «Поделиться» внизу, затем «На экран «Домой»».',
      duration: 6000,
    })

  return { status, inApp, promptInstall, showIosHint }
}

// Компактная кнопка «Установить» — показывается сама только когда установка доступна
// (Android/десктоп с beforeinstallprompt) или на iOS (с инструкцией). В остальных
// случаях — null (для шапки, чтобы не мозолить глаза). Развёрнутый вариант с
// пояснениями — в AppearanceCard.
export function InstallButton({
  size = 'lg',
  variant = 'outline',
  label = 'Установить на смартфон',
  className = 'gap-2 px-8 text-base',
}: {
  size?: 'sm' | 'lg' | 'default' | 'icon'
  variant?: 'outline' | 'ghost' | 'default' | 'secondary'
  label?: string
  className?: string
} = {}) {
  const { status, promptInstall, showIosHint } = useInstallPrompt()

  if (status !== 'available' && status !== 'ios') return null

  const handleClick = () => (status === 'ios' ? showIosHint() : promptInstall())

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <Download className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      {label}
    </Button>
  )
}

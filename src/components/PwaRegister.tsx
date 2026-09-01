'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { subscribePush, onForegroundMessage } from '@/lib/push'
import { initAnalytics } from '@/lib/firebase'
// Подключаем глобальный перехват beforeinstallprompt как можно раньше и на любой
// странице (PwaRegister в корневом layout), чтобы не упустить событие установки.
import '@/lib/pwaInstall'

// Регистрирует service worker (нужно для установки PWA — правка 16).
export function PwaRegister() {
  const queryClient = useQueryClient()

  // Пуш при открытой вкладке: показываем тост и обновляем колокол в шапке.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    onForegroundMessage(msg => {
      toast(msg.title, { description: msg.body })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }).then(fn => { unsubscribe = fn })
    return () => unsubscribe?.()
  }, [queryClient])

  useEffect(() => {
    // Firebase Analytics — no-op без конфига и там, где он не поддерживается.
    initAnalytics().catch(() => {})

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => {
          // Тихо обновляем FCM-токен тем, кто уже разрешил уведомления
          // (без всплывающего запроса). Новым можно подписаться по кнопке.
          subscribePush(false).catch(() => {})
        })
        .catch(() => {
          // регистрация не критична — тихо игнорируем ошибку
        })
    }
  }, [])
  return null
}

// Клиентская подписка на push через Firebase Cloud Messaging.
//
// Требует NEXT_PUBLIC_FIREBASE_* (конфиг веб-приложения) и
// NEXT_PUBLIC_FIREBASE_VAPID_KEY — Web Push certificate из Firebase Console
// (Cloud Messaging → Web configuration). Без ключа getToken() токен не выдаст.

import { getMessaging, getToken, onMessage, isSupported as messagingSupported } from 'firebase/messaging'
import { getFirebaseApp } from '@/lib/firebase'

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Подписывает устройство на push и отправляет FCM-токен на сервер.
 * @param prompt — запрашивать ли разрешение. При false только обновляет токен
 *   уже разрешившим пользователям, не показывая браузерный запрос.
 */
export async function subscribePush(prompt = true): Promise<boolean> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey || !isPushSupported()) return false

  const app = getFirebaseApp()
  if (!app || !(await messagingSupported())) return false

  if (Notification.permission === 'denied') return false
  if (Notification.permission !== 'granted') {
    if (!prompt) return false
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
  }

  try {
    // FCM обслуживается отдельным воркером: firebase-messaging-sw.js показывает
    // уведомления, когда вкладка закрыта. Основной sw.js остаётся под PWA.
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

    const token = await getToken(getMessaging(app), {
      vapidKey,
      serviceWorkerRegistration: registration,
    })
    if (!token) return false

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    return res.ok
  } catch {
    return false
  }
}

export type ForegroundMessage = { title: string; body: string; url: string }

/**
 * Уведомления, пришедшие при открытой вкладке. Их FCM не показывает сам —
 * фоновый воркер в этот момент не вызывается, поэтому показываем своими силами.
 * Возвращает функцию отписки (или no-op, если push не поддерживается).
 */
export async function onForegroundMessage(
  handler: (msg: ForegroundMessage) => void,
): Promise<() => void> {
  const app = getFirebaseApp()
  if (!app || !isPushSupported() || !(await messagingSupported())) return () => {}

  return onMessage(getMessaging(app), payload => {
    const data = payload.data ?? {}
    handler({
      title: data.title ?? 'Zabron',
      body: data.body ?? '',
      url: data.url ?? '/',
    })
  })
}

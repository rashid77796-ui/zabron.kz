// Минимальный service worker — нужен, чтобы браузер разрешил установку PWA
// (Add to Home Screen). Кэширование намеренно не делаем, чтобы не мешать
// обновлениям контента; при необходимости офлайн-кэш добавим отдельно.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Пустой обработчик fetch обязателен для критериев установки в Chrome.
self.addEventListener('fetch', () => {})

// Web-push: показ уведомления при получении пуша (правка #44)
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || 'Zabron'
  const options = {
    body: data.body || 'У вас новое уведомление',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  }
  // Значок-счётчик на иконке приложения при пуше в закрытом состоянии (Badging API).
  // Сервер может прислать data.unread — число непрочитанных. Требует включённого web-push.
  if (typeof data.unread === 'number' && self.navigator && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(data.unread).catch(() => {})
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Клик по уведомлению — открыть/сфокусировать нужную страницу (правка #44)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})

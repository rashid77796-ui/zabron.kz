// Service worker для фоновых push-уведомлений Firebase Cloud Messaging.
//
// Живёт отдельно от sw.js: FCM требует воркер именно с этим именем в корне,
// а sw.js остаётся отвечать за установку PWA.
//
// Конфиг захардкожен намеренно — воркер не имеет доступа к process.env, а эти
// значения и так публичные (уходят в клиентский бандл).

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyA0UGpoF53lvn_D4jGNkJSyeXPCLB4z9dw',
  authDomain: 'zabron-224a2.firebaseapp.com',
  projectId: 'zabron-224a2',
  storageBucket: 'zabron-224a2.firebasestorage.app',
  messagingSenderId: '546851473166',
  appId: '1:546851473166:web:cc0a74876802d68f7df95f',
})

const messaging = firebase.messaging()

// Сервер шлёт только data-payload: если бы в сообщении был блок notification,
// браузер показал бы уведомление сам, и здесь получился бы второй такой же.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  const title = data.title || 'Zabron'

  if (data.unread && self.navigator && self.navigator.setAppBadge) {
    const unread = Number(data.unread)
    if (!Number.isNaN(unread)) self.navigator.setAppBadge(unread).catch(() => {})
  }

  return self.registration.showNotification(title, {
    body: data.body || 'У вас новое уведомление',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  })
})

// Клик по уведомлению — открыть или сфокусировать нужную страницу.
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

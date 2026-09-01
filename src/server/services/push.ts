import { prisma } from '@/server/db/client'
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

/**
 * Push-уведомления через Firebase Cloud Messaging.
 *
 * Требует в окружении:
 *   FIREBASE_SERVICE_ACCOUNT — JSON сервисного аккаунта одной строкой
 *     (Firebase Console → Project settings → Service accounts → Generate key).
 *   NEXT_PUBLIC_FIREBASE_VAPID_KEY — Web Push certificate, нужен клиенту,
 *     чтобы получить токен устройства.
 * Без сервисного аккаунта функции работают как no-op — отправка молча пропускается.
 */

export type PushPayload = { title: string; body: string; url?: string }

let cachedApp: App | null = null

/** Admin SDK инициализируется один раз: повторный initializeApp бросает ошибку. */
function getAdminApp(): App | null {
  if (cachedApp) return cachedApp

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null

  try {
    const existing = getApps()
    cachedApp = existing.length ? existing[0] : initializeApp({ credential: cert(JSON.parse(raw)) })
    return cachedApp
  } catch {
    // Битый JSON в переменной не должен ронять обработку брони — тихо отключаем пуши.
    return null
  }
}

/** Сохранить/обновить FCM-токен устройства пользователя. */
export async function saveFcmToken(userId: string, token: string) {
  // Токен уникален и может переехать между аккаунтами на общем устройстве,
  // поэтому upsert по токену, а не по паре с userId.
  await prisma.fcmToken.upsert({
    where: { token },
    update: { userId },
    create: { userId, token },
  })
}

/**
 * Обратная совместимость со старым VAPID-роутом.
 * @deprecated Подписки больше не используются для отправки — см. saveFcmToken.
 */
export async function savePushSubscription(userId: string, sub: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  })
}

/** Отправить push на все устройства пользователя. Тихий no-op, если не настроено. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const app = getAdminApp()
  if (!app) return

  const tokens = await prisma.fcmToken.findMany({ where: { userId }, select: { token: true } })
  if (tokens.length === 0) return

  // Только data-payload: с блоком notification браузер показал бы уведомление
  // сам, а firebase-messaging-sw.js показал бы второе такое же.
  const res = await getMessaging(app).sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    data: {
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
    },
  })

  // Протухшие токены удаляем, иначе они копятся и каждый раз дают ошибку.
  const dead: string[] = []
  res.responses.forEach((r, i) => {
    const code = r.error?.code
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
      dead.push(tokens[i].token)
    }
  })
  if (dead.length) {
    await prisma.fcmToken.deleteMany({ where: { token: { in: dead } } }).catch(() => {})
  }
}

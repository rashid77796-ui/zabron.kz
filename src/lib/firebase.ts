'use client'

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAnalytics, isSupported as analyticsSupported, type Analytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

/** Настроен ли Firebase в этом окружении (в dev без .env — нет). */
export const isFirebaseConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId

/**
 * Приложение Firebase. `getApps()` защищает от повторной инициализации при
 * hot-reload в dev — иначе SDK ругается на дубль приложения.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured || typeof window === 'undefined') return null
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

/**
 * Analytics. Возвращает null там, где он не поддерживается: SSR, отключённые
 * cookies, часть in-app браузеров. Поэтому проверяем isSupported(), а не просто
 * наличие window — иначе getAnalytics() бросает исключение.
 */
export async function initAnalytics(): Promise<Analytics | null> {
  const app = getFirebaseApp()
  if (!app) return null
  if (!(await analyticsSupported())) return null
  return getAnalytics(app)
}

// Глобальный перехват события установки PWA (правки #16/#50).
//
// Chrome присылает `beforeinstallprompt` ОДИН раз и рано (вскоре после загрузки
// первой страницы). Если слушатель подключается позже (когда пользователь дошёл
// до настроек), событие уже потеряно и кнопка «Установить» остаётся неактивной.
// Поэтому ловим событие на уровне модуля — слушатель ставится при первой загрузке
// приложения (модуль импортируется корневым PwaRegister), а сохранённый prompt
// доступен любой кнопке в любой момент.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    emit()
  })
}

/** Пришло ли от браузера предложение установки (можно показать рабочую кнопку). */
export function getDeferredPrompt() {
  return deferredPrompt
}

/** Установлено ли приложение (по событию appinstalled). */
export function isAppInstalled() {
  return installed
}

/** Подписка на изменения состояния установки; возвращает функцию отписки. */
export function subscribeInstall(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Показать системный запрос установки. Возвращает true, если пользователь согласился. */
export async function triggerInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  emit()
  return outcome === 'accepted'
}

'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import ru, { type Translations } from './ru'
import en from './en'
import kk from './kk'

export type Locale = 'ru' | 'en' | 'kk'

const TRANSLATIONS: Record<Locale, Translations> = { ru, en, kk }
const LOCALE_KEY = 'rh_locale'

interface I18nContextType {
  locale: Locale
  t: Translations
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextType>({
  locale: 'ru',
  t: ru,
  setLocale: () => {},
})

export function I18nProvider({ children, defaultLocale }: { children: ReactNode; defaultLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return defaultLocale ?? 'ru'
    return (localStorage.getItem(LOCALE_KEY) as Locale) ?? defaultLocale ?? 'ru'
  })

  const setLocale = (l: Locale) => {
    localStorage.setItem(LOCALE_KEY, l)
    setLocaleState(l)
  }

  return (
    <I18nContext.Provider value={{ locale, t: TRANSLATIONS[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export { type Translations }

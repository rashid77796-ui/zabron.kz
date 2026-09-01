'use client'

import { createContext, ReactNode, useEffect, useRef } from 'react'
import { useSession, authClient } from '@/lib/auth-client'
import type { User, UserRole } from '@/lib/types'

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User | null>
  register: (name: string, email: string, password: string, role: 'client' | 'merchant', phone?: string) => Promise<User | null>
  logout: () => Promise<void>
  loginAs: (targetUser: User) => void
  returnToAdmin: () => void
  refreshUser: () => void
  resendVerification: () => Promise<boolean>
  isImpersonating: boolean
}

export const AuthContext = createContext<AuthContextType | null>(null)

const IMPERSONATE_KEY = 'rh_original_user'

type SessionUser = { id: string; name: string; email: string; role?: string; phone?: string; image?: string; link?: string; noShowCount?: number; emailVerified?: boolean; isAnonymous?: boolean }

function sessionToUser(sessionUser: SessionUser | undefined | null): User | null {
  if (!sessionUser) return null
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    phone: sessionUser.phone ?? '',
    role: (sessionUser.role as UserRole) ?? 'client',
    image: sessionUser.image ?? undefined,
    link: sessionUser.link ?? undefined,
    noShowCount: sessionUser.noShowCount ?? 0,
    emailVerified: sessionUser.emailVerified ?? false,
    isAnonymous: sessionUser.isAnonymous ?? false,
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, isPending, refetch } = useSession()

  const user = sessionToUser(session?.user as SessionUser | undefined)

  // Гостевая сессия каждому, кто просто зашёл на сайт: без неё избранное,
  // брони и отзывы некуда писать до регистрации. При первом входе/регистрации
  // всё накопленное переезжает на постоянный аккаунт — onLinkAccount в
  // server/auth/auth.ts. Ошибку глотаем: сайт должен работать и без гостя.
  const guestSignInStarted = useRef(false)
  useEffect(() => {
    if (isPending || session?.user || guestSignInStarted.current) return
    // На /auth гостя не заводим: там пользователь пришёл именно войти, и
    // свежая анонимная сессия только мешала бы (в т.ч. сразу после выхода).
    if (window.location.pathname.startsWith('/auth')) return
    guestSignInStarted.current = true
    authClient.signIn
      .anonymous()
      .then(() => refetch())
      .catch(() => {})
  }, [isPending, session, refetch])

  const login = async (email: string, password: string): Promise<User | null> => {
    const { data, error } = await authClient.signIn.email({ email, password })
    if (error || !data?.user) return null
    return sessionToUser(data.user as SessionUser)
  }

  const register = async (
    name: string,
    email: string,
    password: string,
    role: 'client' | 'merchant',
    phone = '',
  ): Promise<User | null> => {
    const { data, error } = await authClient.signUp.email({ name, email, password, role, phone } as Parameters<typeof authClient.signUp.email>[0])
    if (error) throw error
    if (!data?.user) return null
    return sessionToUser(data.user as SessionUser)
  }

  const logout = async () => {
    localStorage.removeItem(IMPERSONATE_KEY)
    sessionStorage.removeItem('rh_impersonate')
    await authClient.signOut()
  }

  const resendVerification = async (): Promise<boolean> => {
    if (!user?.email) return false
    const { error } = await authClient.sendVerificationEmail({
      email: user.email,
      callbackURL: '/',
    })
    return !error
  }

  const loginAs = (targetUser: User) => {
    if (!user || user.role !== 'super_admin') return
    localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(user))
    sessionStorage.setItem('rh_impersonate', JSON.stringify(targetUser))
    window.location.reload()
  }

  const returnToAdmin = () => {
    localStorage.removeItem(IMPERSONATE_KEY)
    sessionStorage.removeItem('rh_impersonate')
    window.location.reload()
  }

  const isImpersonating = typeof window !== 'undefined' && !!localStorage.getItem(IMPERSONATE_KEY)

  let effectiveUser = user
  if (typeof window !== 'undefined' && isImpersonating) {
    try {
      const imp = sessionStorage.getItem('rh_impersonate')
      if (imp) effectiveUser = JSON.parse(imp) as User
    } catch { /* ignore */ }
  }

  return (
    <AuthContext.Provider value={{
      user: effectiveUser,
      isLoading: isPending,
      login,
      register,
      logout,
      loginAs,
      returnToAdmin,
      refreshUser: () => refetch(),
      resendVerification,
      isImpersonating,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

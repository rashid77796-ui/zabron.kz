'use client'

import { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/AuthProvider'
import Header from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { Footer } from '@/components/Footer'
// Внутри QueryClientProvider: слушатель foreground-пушей обновляет колокол
// уведомлений через queryClient, снаружи хук useQueryClient упал бы.
import { PwaRegister } from '@/components/PwaRegister'
import { CategoryNav } from '@/components/CategoryNav'
import EmailVerificationGate from '@/components/EmailVerificationGate'
import { useAuth } from '@/lib/useAuth'
import { I18nProvider } from '@/lib/i18n'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
})

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isImpersonating, returnToAdmin } = useAuth()

  // Неподтверждённый зарегистрированный пользователь видит только экран
  // подтверждения почты — остальной функционал заблокирован. Админов и
  // модераторов (создаются вручную) и режим имперсонации не блокируем.
  // Гость (anonymous) исключён намеренно: у него служебный email на @anon.zabron.kz,
  // подтверждать нечего — иначе вход без регистрации упирался бы в экран проверки почты.
  const needsVerification =
    !!user &&
    !isImpersonating &&
    !user.isAnonymous &&
    user.emailVerified === false &&
    (user.role === 'client' || user.role === 'merchant')

  return (
    <>
      <Header
        user={user}
        isImpersonating={isImpersonating}
        onReturnToAdmin={returnToAdmin}
      />
      <Suspense fallback={null}>
        <CategoryNav />
      </Suspense>

      <main className="min-h-[calc(100vh-4rem)] pb-14 sm:pb-0">
        {needsVerification ? <EmailVerificationGate /> : children}
      </main>
      <Footer />
      <Suspense fallback={null}>
        <BottomNav user={user} />
      </Suspense>
      <PwaRegister />
    </>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <I18nProvider>
          <TooltipProvider>
            <Sonner />
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

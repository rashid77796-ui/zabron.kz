'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, MailCheck, RefreshCw } from 'lucide-react'

const RESEND_COOLDOWN_SEC = 60

export default function EmailVerificationGate() {
  const { user, resendVerification, logout, refreshUser } = useAuth()
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cooldown, setCooldown] = useState(0) // сек до повторной отправки (правка #8)

  // Обратный отсчёт кулдауна, чтобы нельзя было спамить письмами
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleResend = async () => {
    setSending(true)
    const ok = await resendVerification()
    setSending(false)
    if (ok) {
      setCooldown(RESEND_COOLDOWN_SEC)
      toast.success('Письмо отправлено', { description: 'Проверьте почту и папку «Спам».' })
    } else {
      toast.error('Не удалось отправить письмо', { description: 'Попробуйте позже.' })
    }
  }

  const handleCheck = async () => {
    setChecking(true)
    await refreshUser()
    // небольшая пауза, чтобы сессия успела обновиться
    setTimeout(() => setChecking(false), 800)
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold">Подтвердите email</h2>
            <p className="text-sm text-muted-foreground">
              Мы отправили письмо со ссылкой на{' '}
              <span className="font-medium text-foreground">{user?.email}</span>.
              Перейдите по ссылке из письма, чтобы получить доступ к сервису.
            </p>
            <p className="text-xs text-muted-foreground">
              Не нашли письмо? Проверьте папку «Спам» или отправьте его ещё раз.
            </p>
          </div>

          <div className="space-y-2">
            <Button className="w-full" onClick={handleResend} disabled={sending || cooldown > 0}>
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : cooldown > 0
                ? `Отправить повторно можно через ${cooldown} с`
                : 'Отправить письмо повторно'}
            </Button>
            <Button variant="outline" className="w-full" onClick={handleCheck} disabled={checking}>
              {checking
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><RefreshCw className="h-4 w-4 mr-2" />Я подтвердил(а) — обновить</>}
            </Button>
          </div>

          <button
            onClick={() => logout()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Выйти из аккаунта
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

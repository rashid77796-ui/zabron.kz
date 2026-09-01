'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { toast } from 'sonner'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Требования к паролю: длина 8+ + буквы + цифры (правка #9)
    if (password.length < 8 || password.length > 128) {
      toast.error('Пароль должен быть от 8 до 128 символов')
      return
    }
    if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
      toast.error('Пароль должен содержать буквы и цифры')
      return
    }
    if (password !== confirm) {
      toast.error('Пароли не совпадают')
      return
    }
    setLoading(true)
    try {
      const { authClient } = await import('@/lib/auth-client')
      await authClient.resetPassword({ token, newPassword: password })
      setDone(true)
      setTimeout(() => router.push('/auth'), 2500)
    } catch {
      toast.error('Ссылка недействительна или истекла', {
        description: 'Запросите новую ссылку для сброса пароля',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center text-muted-foreground">
            <p>Недействительная ссылка. Запросите сброс пароля повторно.</p>
            <Button variant="link" onClick={() => router.push('/auth')} className="mt-2">
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center">
            <Logo variant="wordmark" className="h-7 w-auto" />
          </div>
          <h2 className="text-lg font-semibold">Новый пароль</h2>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="font-medium">Пароль успешно изменён</p>
              <p className="text-sm text-muted-foreground">Перенаправляем на страницу входа…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Новый пароль</Label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                />
              </div>
              <div className="space-y-2">
                <Label>Повторите пароль</Label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Сохранить пароль'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}

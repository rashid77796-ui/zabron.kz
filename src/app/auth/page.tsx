'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Gift, Eye, EyeOff, Check, X, UserRound } from 'lucide-react'
import { Logo } from '@/components/Logo'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n'

function AuthContent() {
  const { login, register, refreshUser } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''

  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [regData, setRegData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'client' as 'client' | 'merchant',
  })
  const [consentGiven, setConsentGiven] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [resetStep, setResetStep] = useState<'hidden' | 'email'>('hidden')
  const [resetEmail, setResetEmail] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const u = await login(loginData.email, loginData.password)
    setLoading(false)
    if (u) {
      toast.success(`Добро пожаловать, ${u.name}!`)
      router.push(u.role === 'super_admin' ? '/admin' : u.role === 'merchant' ? '/owner' : '/')
    } else {
      toast.error('Неверный email или пароль')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const u = await register(regData.name, regData.email, regData.password, regData.role, regData.phone)
      if (u) {
        if (refCode) api.referrals.apply(refCode).catch(() => {})
        // Сессия создаётся сразу (autoSignIn) — глобальный EmailVerificationGate
        // покажет корректный экран подтверждения email (правка #8).
        toast.success('Аккаунт создан', { description: 'Подтвердите email по ссылке из письма' })
        router.push('/')
      } else {
        toast.error('Не удалось создать аккаунт')
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
        toast.error('Этот email уже занят')
      } else {
        toast.error('Не удалось создать аккаунт')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      const { authClient } = await import('@/lib/auth-client')
      await authClient.signIn.social({ provider: 'google', callbackURL: '/' })
    } catch {
      toast.error('Не удалось войти через Google')
      setGoogleLoading(false)
    }
  }

  // Вход без регистрации: better-auth заводит временного пользователя с
  // isAnonymous. Всё, что гость набронирует, переедет на постоянный аккаунт
  // при первом входе или регистрации (onLinkAccount в server/auth/auth.ts).
  const handleGuestSignIn = async () => {
    setGuestLoading(true)
    try {
      const { authClient } = await import('@/lib/auth-client')
      const { error } = await authClient.signIn.anonymous()
      if (error) throw new Error(error.message)
      await refreshUser()
      router.push('/')
    } catch {
      toast.error(t.auth.guestFailed)
      setGuestLoading(false)
    }
  }

  const handleResetEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { authClient } = await import('@/lib/auth-client')
      await authClient.requestPasswordReset({ email: resetEmail, redirectTo: `${window.location.origin}/auth/reset-password` })
      toast.success('Письмо отправлено', { description: 'Проверьте вашу почту' })
      setResetStep('hidden')
    } catch {
      toast.error('Не удалось отправить письмо')
    } finally {
      setLoading(false)
    }
  }

  if (resetStep !== 'hidden') {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <button
              onClick={() => setResetStep('hidden')}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />Назад ко входу
            </button>
            <h2 className="text-xl font-bold">Восстановление пароля</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetEmail} className="space-y-4">
              <p className="text-sm text-muted-foreground">Введите email, указанный при регистрации</p>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Отправить ссылку'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Требования к паролю: длина + буквы + цифры (правка #9)
  const passwordRules = [
    { label: 'От 8 до 128 символов', ok: regData.password.length >= 8 && regData.password.length <= 128 },
    { label: 'Содержит букву', ok: /\p{L}/u.test(regData.password) },
    { label: 'Содержит цифру', ok: /\d/.test(regData.password) },
  ]
  const passwordValid = passwordRules.every(r => r.ok)

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <Logo variant="wordmark" className="h-9 w-auto" priority />
          </div>
          <p className="text-muted-foreground text-sm">Войдите или создайте аккаунт</p>
        </div>

        {refCode && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            <Gift className="h-4 w-4 shrink-0" />
            <span>Вас пригласил друг — при регистрации оба получите бонус</span>
          </div>
        )}

        <Card>
          <Tabs defaultValue={refCode ? 'register' : 'login'}>
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="register">Регистрация</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-6">
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.auth.email}</Label>
                    <Input type="email" required value={loginData.email} onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.auth.password}</Label>
                    <div className="relative">
                      <Input type={showLoginPassword ? 'text' : 'password'} required value={loginData.password} onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))} className="pr-10" />
                      <button type="button" onClick={() => setShowLoginPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.auth.loginBtn}
                  </Button>
                  <button type="button" onClick={() => setResetStep('email')} className="w-full text-center text-sm text-primary hover:underline">
                    {t.auth.forgotPassword}
                  </button>
                </form>
                {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true' && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">или</span></div>
                    </div>
                    <Button variant="outline" className="w-full gap-2" onClick={handleGoogleSignIn} disabled={googleLoading}>
                      {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      )}
                      Войти через Google
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.auth.name}</Label>
                    <Input required value={regData.name} onChange={e => setRegData(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.auth.phone}</Label>
                    <PhoneInput value={regData.phone} onChange={v => setRegData(p => ({ ...p, phone: v }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.auth.email}</Label>
                    <Input type="email" required value={regData.email} onChange={e => setRegData(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.auth.password}</Label>
                    <div className="relative">
                      <Input type={showRegPassword ? 'text' : 'password'} required minLength={8} maxLength={128} value={regData.password} onChange={e => setRegData(p => ({ ...p, password: e.target.value }))} className="pr-10" />
                      <button type="button" onClick={() => setShowRegPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {passwordRules.map(rule => (
                        <li
                          key={rule.label}
                          className={`flex items-center gap-1.5 text-xs transition-colors ${
                            regData.password.length === 0
                              ? 'text-muted-foreground'
                              : rule.ok
                                ? 'text-green-600'
                                : 'text-destructive'
                          }`}
                        >
                          {regData.password.length > 0 && !rule.ok
                            ? <X className="h-3 w-3 shrink-0" />
                            : <Check className="h-3 w-3 shrink-0" />}
                          {rule.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <Label>Тип аккаунта</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['client', 'merchant'] as const).map(r => (
                        <button key={r} type="button" onClick={() => setRegData(p => ({ ...p, role: r }))}
                          className={`rounded-xl border p-3 text-sm transition-colors ${regData.role === r ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}>
                          {r === 'client' ? t.auth.asClient : t.auth.asMerchant}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={consentGiven}
                      onChange={e => setConsentGiven(e.target.checked)}
                      required
                    />
                    <span className="text-muted-foreground">
                      Я согласен(а) с{' '}
                      <a href="/terms" target="_blank" className="text-primary underline">Условиями использования</a>
                      {' '}и{' '}
                      <a href="/privacy" target="_blank" className="text-primary underline">Политикой конфиденциальности</a>
                      {' '}и даю согласие на обработку персональных данных в соответствии с Законом РК «О персональных данных и их защите»
                    </span>
                  </label>
                  <Button type="submit" className="w-full" disabled={loading || !consentGiven || !passwordValid}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.auth.registerBtn}
                  </Button>
                </form>
              </TabsContent>

              {/* Гостевой вход — общий для обеих вкладок, поэтому вне TabsContent */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs text-muted-foreground">
                  <span className="bg-card px-2">{t.auth.or}</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleGuestSignIn}
                disabled={guestLoading}
              >
                {guestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                {t.auth.continueAsGuest}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">{t.auth.guestNote}</p>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  )
}

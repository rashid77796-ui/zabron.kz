'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// Смена пароля прямо в кабинете — общий блок для клиента, владельца и админа (правка #46).
export function ChangePasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  // Те же требования сложности, что при регистрации (правка #9)
  const rules = [
    { label: 'От 8 до 128 символов', ok: next.length >= 8 && next.length <= 128 },
    { label: 'Содержит букву', ok: /\p{L}/u.test(next) },
    { label: 'Содержит цифру', ok: /\d/.test(next) },
  ]
  const valid = rules.every(r => r.ok) && next === confirm && current.length > 0

  const handleSave = async () => {
    if (!valid) return
    setLoading(true)
    try {
      const { authClient } = await import('@/lib/auth-client')
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      })
      if (error) {
        toast.error('Не удалось сменить пароль', { description: 'Проверьте текущий пароль' })
      } else {
        toast.success('Пароль изменён')
        setCurrent(''); setNext(''); setConfirm('')
      }
    } catch {
      toast.error('Не удалось сменить пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Смена пароля</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Текущий пароль</Label>
            <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="mt-1 h-9 text-sm" autoComplete="current-password" />
          </div>
          <div>
            <Label className="text-xs">Новый пароль</Label>
            <Input type="password" value={next} onChange={e => setNext(e.target.value)} className="mt-1 h-9 text-sm" autoComplete="new-password" />
          </div>
          <div>
            <Label className="text-xs">Повтор нового</Label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 h-9 text-sm" autoComplete="new-password" />
          </div>
        </div>
        {next.length > 0 && (
          <ul className="text-xs space-y-0.5">
            {rules.map(r => (
              <li key={r.label} className={r.ok ? 'text-green-600' : 'text-muted-foreground'}>
                {r.ok ? '✓' : '•'} {r.label}
              </li>
            ))}
            {confirm.length > 0 && next !== confirm && <li className="text-destructive">• Пароли не совпадают</li>}
          </ul>
        )}
        <Button size="sm" onClick={handleSave} disabled={loading || !valid}>
          {loading ? 'Сохраняем...' : 'Сменить пароль'}
        </Button>
        <p className="text-[11px] text-muted-foreground">Если вы входите через Google и пароль не задавали — используйте «Забыли пароль?» на странице входа.</p>
      </CardContent>
    </Card>
  )
}

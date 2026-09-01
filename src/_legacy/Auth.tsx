import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';
import { findUserByEmail, updateUser } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

const Auth = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [regData, setRegData] = useState({ name: '', email: '', password: '', phone: '', role: 'client' as 'client' | 'owner' });

  // Password reset state
  const [resetStep, setResetStep] = useState<'hidden' | 'email' | 'newpass'>('hidden');
  const [resetEmail, setResetEmail] = useState('');
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = login(loginData.email, loginData.password);
    if (u) {
      toast.success(`Добро пожаловать, ${u.name}!`);
      navigate(u.role === 'admin' ? '/admin' : u.role === 'owner' ? '/owner' : '/');
    } else {
      toast.error('Неверный email или пароль');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const u = register(regData.name, regData.email, regData.password, regData.role, regData.phone);
    if (u) {
      toast.success('Мы отправили вам письмо на почту, пожалуйста подтвердите регистрацию');
      navigate(u.role === 'admin' ? '/admin' : u.role === 'owner' ? '/owner' : '/');
    } else {
      toast.error('Email уже зарегистрирован');
    }
  };

  const handleResetEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = findUserByEmail(resetEmail.trim());
    if (user) {
      setResetUserId(user.id);
      setResetStep('newpass');
      toast.success('Аккаунт найден. Введите новый пароль.');
    } else {
      toast.error('Пользователь с таким email не найден');
    }
  };

  const handleNewPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    const user = findUserByEmail(resetEmail);
    if (user) {
      updateUser({ ...user, password: newPassword });
      toast.success('Пароль успешно изменён! Войдите с новым паролем.');
      setResetStep('hidden');
      setResetEmail('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  if (resetStep !== 'hidden') {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <button
              onClick={() => { setResetStep('hidden'); setResetEmail(''); setNewPassword(''); setConfirmPassword(''); }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />Назад ко входу
            </button>
            <CardTitle>{resetStep === 'email' ? 'Восстановление пароля' : 'Новый пароль'}</CardTitle>
          </CardHeader>
          <CardContent>
            {resetStep === 'email' ? (
              <form onSubmit={handleResetEmailSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">Введите email, указанный при регистрации</p>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">Найти аккаунт</Button>
              </form>
            ) : (
              <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">Установите новый пароль для <strong>{resetEmail}</strong></p>
                <div className="space-y-2">
                  <Label>Новый пароль</Label>
                  <Input type="password" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Подтвердите пароль</Label>
                  <Input type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">Сохранить пароль</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <Tabs defaultValue="login">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={loginData.email} onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Пароль</Label>
                  <Input type="password" required value={loginData.password} onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full">Войти</Button>
                <button
                  type="button"
                  onClick={() => setResetStep('email')}
                  className="w-full text-center text-sm text-primary hover:underline"
                >
                  Забыли пароль?
                </button>
                <p className="text-xs text-center text-muted-foreground">Тест: owner@test.com / 123456 | admin@test.com / admin123</p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label>Имя</Label>
                  <Input required value={regData.name} onChange={e => setRegData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <Input type="tel" required placeholder="+7 777 123 4567" value={regData.phone} onChange={e => setRegData(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={regData.email} onChange={e => setRegData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Пароль</Label>
                  <Input type="password" required minLength={6} value={regData.password} onChange={e => setRegData(p => ({ ...p, password: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Тип аккаунта</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['client', 'owner'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRegData(p => ({ ...p, role: r }))}
                        className={`rounded-lg border p-3 text-sm transition-colors ${regData.role === r ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                      >
                        {r === 'client' ? '🧖 Клиент' : '🏠 Владелец'}
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full">Зарегистрироваться</Button>
              </form>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;

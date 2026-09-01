import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useSearchParams } from 'react-router-dom';
import { getBookingsByClient, getBathhouseById, getCabinById, updateUser } from '@/lib/store';
import { Booking } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Navigate } from 'react-router-dom';
import { Phone, User, Pencil, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

const statusMap = {
  pending: { label: 'Ожидает', variant: 'secondary' as const },
  confirmed: { label: 'Подтверждена', variant: 'default' as const },
  rejected: { label: 'Отклонена', variant: 'destructive' as const },
};

const ClientDashboard = () => {
  const { user, refreshUser } = useAuth();
  const [bookings, setBookings] = useState<(Booking & { bathhouseName: string; cabinName: string })[]>([]);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('booking');
  const highlightRef = useRef<HTMLDivElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLink, setEditLink] = useState('');

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone || '');
      setEditLink(user.link || '');
      const b = getBookingsByClient(user.id).map(bk => ({
        ...bk,
        bathhouseName: getBathhouseById(bk.bathhouseId)?.name || 'Неизвестно',
        cabinName: getCabinById(bk.cabinId)?.name || '',
      }));
      setBookings(b.sort((a, c) => c.createdAt.localeCompare(a.createdAt)));
    }
  }, [user]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [bookings, highlightId]);

  if (!user) return <Navigate to="/auth" />;

  const handleSaveProfile = () => {
    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();
    if (!trimmedName) { toast.error('Имя не может быть пустым'); return; }
    if (!trimmedPhone) { toast.error('Телефон не может быть пустым'); return; }

    const updated = { ...user, name: trimmedName, phone: trimmedPhone, link: editLink.trim() };
    updateUser(updated);
    refreshUser();
    setEditOpen(false);
    toast.success('Профиль обновлён');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Mini profile */}
      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">{user.name}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{user.email}</span>
              {user.phone && (
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{user.phone}</span>
              )}
              {user.link && (
                <a href={user.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <LinkIcon className="h-3.5 w-3.5" />{user.link.replace(/^https?:\/\//, '').slice(0, 30)}
                </a>
              )}
            </div>
          </div>
          <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (o) { setEditName(user.name); setEditPhone(user.phone || ''); setEditLink(user.link || ''); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-4 w-4" />Редактировать
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Редактировать профиль</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Имя</Label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <Input type="tel" placeholder="+7 777 123 4567" value={editPhone} onChange={e => setEditPhone(e.target.value)} maxLength={20} />
                </div>
                <div className="space-y-2">
                  <Label>Ссылка</Label>
                  <Input type="url" placeholder="https://instagram.com/..." value={editLink} onChange={e => setEditLink(e.target.value)} maxLength={500} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <Input value={user.email} disabled />
                </div>
                <Button onClick={handleSaveProfile} className="w-full">Сохранить</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <h1 className="mb-6 text-2xl font-bold">Мои бронирования</h1>
      {bookings.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">У вас пока нет бронирований</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map(b => {
            const st = statusMap[b.status] || statusMap.pending;
            return (
              <Card
                key={b.id}
                ref={b.id === highlightId ? highlightRef : undefined}
                className={b.id === highlightId ? 'ring-2 ring-primary animate-pulse' : ''}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{b.bathhouseName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {b.cabinName && <p><strong>Кабинка:</strong> {b.cabinName}</p>}
                  <p><strong>Дата:</strong> {b.date}</p>
                  <p><strong>Время:</strong> {b.startTime} – {b.endTime}</p>
                  <p><strong>Гостей:</strong> {b.guests}</p>
                  <Badge className="mt-2" variant={st.variant}>{st.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;

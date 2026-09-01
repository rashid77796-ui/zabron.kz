import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBookings, getBathhouseById, getCabinById, updateBookingStatus } from '@/lib/store';
import { subscribeToStoreUpdates } from '@/lib/store-events';
import { getGuestId } from '@/lib/guest';
import { Booking } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchClientCloudBookings } from '@/lib/cloud-bookings';

const statusMap = {
  pending: { label: 'Ожидает подтверждения', variant: 'secondary' as const },
  confirmed: { label: 'Подтверждена', variant: 'default' as const },
  rejected: { label: 'Отклонена', variant: 'destructive' as const },
};

const MyBookings = () => {
  const [bookings, setBookings] = useState<(Booking & { bathhouseName: string; cabinName: string })[]>([]);

  const refresh = () => {
    const guestId = getGuestId();
    const b = getBookings()
      .filter(bk => bk.clientId === guestId)
      .map(bk => ({
        ...bk,
        bathhouseName: getBathhouseById(bk.bathhouseId)?.name || 'Неизвестно',
        cabinName: getCabinById(bk.cabinId)?.name || '',
      }))
      .sort((a, c) => c.createdAt.localeCompare(a.createdAt));
    setBookings(b);
  };

  useEffect(() => {
    refresh();
    const unsub = subscribeToStoreUpdates(refresh);

    const syncFromCloud = async () => {
      try {
        const guestId = getGuestId();
        const cloud = await fetchClientCloudBookings(guestId);
        const local = getBookings();
        let changed = false;
        cloud.forEach(cb => {
          const lb = local.find(b => b.id === cb.id);
          if (lb && lb.status !== cb.status) {
            updateBookingStatus(cb.id, cb.status);
            changed = true;
          }
        });
        if (changed) refresh();
      } catch (e) {
        console.error('[MyBookings] cloud sync failed', e);
      }
    };
    syncFromCloud();
    const iv = setInterval(syncFromCloud, 15000);
    return () => { unsub(); clearInterval(iv); };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Мои брони</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Список ваших заявок на этом устройстве. Статус обновляется автоматически.
      </p>
      {bookings.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground mb-4">У вас пока нет бронирований</p>
          <Link to="/bathhouses">
            <Button>Перейти в каталог</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map(b => {
            const st = statusMap[b.status] || statusMap.pending;
            return (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <Link to={`/bathhouse/${b.bathhouseId}`} className="hover:text-primary">
                      {b.bathhouseName}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {b.cabinName && <p><strong>Кабинка:</strong> {b.cabinName}</p>}
                  <p><strong>Дата:</strong> {b.date}</p>
                  <p><strong>Время:</strong> {b.startTime} – {b.endTime}</p>
                  <p><strong>Гостей:</strong> {b.guests}</p>
                  {b.clientName && <p><strong>На имя:</strong> {b.clientName}</p>}
                  {b.clientPhone && <p><strong>Телефон:</strong> {b.clientPhone}</p>}
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

export default MyBookings;
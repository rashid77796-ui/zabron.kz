import { useEffect, useState, useRef } from 'react';
import PhotoUpload from '@/components/PhotoUpload';
import BathhouseContactFields from '@/components/BathhouseContactFields';
import { useAuth } from '@/lib/useAuth';
import { useSearchParams } from 'react-router-dom';
import { getBathhouses, saveBathhouse, updateBathhouse, getCabinsByBathhouse, saveCabin, updateCabin, deleteCabin, generateSlotsForCabin, bookSlot, unbookSlot, getBookingsByBathhouse, getCabinById, updateBookingStatus } from '@/lib/store';
import { Bathhouse, Cabin, TimeSlot, Booking } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Lock, Unlock, Check, X, Phone, User } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import LocationPicker from '@/components/LocationPicker';
import ClientsTab from '@/components/ClientsTab';

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const statusMap = {
  pending: { label: 'Ожидает', variant: 'secondary' as const, color: 'text-yellow-600' },
  confirmed: { label: 'Подтверждена', variant: 'default' as const, color: 'text-green-600' },
  rejected: { label: 'Отклонена', variant: 'destructive' as const, color: 'text-red-600' },
};

const OwnerDashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('booking');
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const [myBathhouses, setMyBathhouses] = useState<Bathhouse[]>([]);
  const [selectedBh, setSelectedBh] = useState<string>('');
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [selectedCabin, setSelectedCabin] = useState<string>('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showAddBh, setShowAddBh] = useState(false);
  const [editBhData, setEditBhData] = useState<Bathhouse | null>(null);
  const [showAddCabin, setShowAddCabin] = useState(false);
  const [editCabinData, setEditCabinData] = useState<Cabin | null>(null);
  const [selectedClient, setSelectedClient] = useState<Booking | null>(null);

  const [bhForm, setBhForm] = useState({ name: '', address: '', description: '', link: '', phone: '', email: '', website: '', instagram: '', whatsapp: '', photos: [] as string[], lat: '51.1284', lng: '71.4306' });
  const [cabinForm, setCabinForm] = useState({ name: '', description: '', price: '', maxGuests: '', photos: [] as string[], workStart: '09:00', workEnd: '21:00', slotDuration: '2' });

  const refresh = () => {
    if (!user) return;
    const bhs = getBathhouses().filter(b => b.ownerId === user.id);
    setMyBathhouses(bhs);
    if (bhs.length > 0 && !selectedBh) setSelectedBh(bhs[0].id);
  };

  useEffect(() => { refresh(); }, [user]);

  useEffect(() => {
    if (selectedBh) {
      const cbs = getCabinsByBathhouse(selectedBh);
      setCabins(cbs);
      if (cbs.length > 0 && !cbs.find(c => c.id === selectedCabin)) {
        setSelectedCabin(cbs[0].id);
      }
      setBookings(getBookingsByBathhouse(selectedBh).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
  }, [selectedBh]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [bookings, highlightId]);

  const refreshSlots = () => {
    if (selectedCabin) {
      const cabin = cabins.find(c => c.id === selectedCabin) || getCabinById(selectedCabin);
      if (cabin) setSlots(generateSlotsForCabin(cabin));
    }
    if (selectedBh) {
      setBookings(getBookingsByBathhouse(selectedBh).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
  };

  useEffect(() => { refreshSlots(); }, [selectedCabin, cabins]);

  const refreshCabinsAndSlots = () => {
    const cbs = getCabinsByBathhouse(selectedBh);
    setCabins(cbs);
    setBookings(getBookingsByBathhouse(selectedBh).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  };

  const handleAddBh = () => {
    if (!user) return;
    const bh: Bathhouse = {
      id: crypto.randomUUID(), ownerId: user.id,
      name: bhForm.name, address: bhForm.address, description: bhForm.description,
      link: bhForm.link || undefined, phone: bhForm.phone || undefined, email: bhForm.email || undefined,
      website: bhForm.website || undefined, instagram: bhForm.instagram || undefined, whatsapp: bhForm.whatsapp || undefined,
      photos: bhForm.photos,
      lat: parseFloat(bhForm.lat) || undefined, lng: parseFloat(bhForm.lng) || undefined,
    };
    saveBathhouse(bh);
    setShowAddBh(false);
    setBhForm({ name: '', address: '', description: '', link: '', phone: '', email: '', website: '', instagram: '', whatsapp: '', photos: [], lat: '51.1284', lng: '71.4306' });
    refresh();
    setSelectedBh(bh.id);
    toast.success('Заведение добавлено!');
  };

  const openEditBh = () => {
    const bh = myBathhouses.find(b => b.id === selectedBh);
    if (!bh) return;
    setEditBhData(bh);
    setBhForm({
      name: bh.name, address: bh.address, description: bh.description, link: bh.link || '',
      phone: bh.phone || '', email: bh.email || '', website: bh.website || '',
      instagram: bh.instagram || '', whatsapp: bh.whatsapp || '',
      photos: [...bh.photos], lat: String(bh.lat || '51.1284'), lng: String(bh.lng || '71.4306'),
    });
  };

  const handleEditBh = () => {
    if (!editBhData) return;
    updateBathhouse({
      ...editBhData, name: bhForm.name, address: bhForm.address, description: bhForm.description,
      link: bhForm.link || undefined, phone: bhForm.phone || undefined, email: bhForm.email || undefined,
      website: bhForm.website || undefined, instagram: bhForm.instagram || undefined, whatsapp: bhForm.whatsapp || undefined,
      photos: bhForm.photos.length > 0 ? bhForm.photos : editBhData.photos,
      lat: parseFloat(bhForm.lat) || undefined, lng: parseFloat(bhForm.lng) || undefined,
    });
    setEditBhData(null);
    setBhForm({ name: '', address: '', description: '', link: '', phone: '', email: '', website: '', instagram: '', whatsapp: '', photos: [], lat: '51.1284', lng: '71.4306' });
    refresh();
    toast.success('Заведение обновлено');
  };

  const handleAddCabin = () => {
    const c: Cabin = {
      id: crypto.randomUUID(), bathhouseId: selectedBh,
      name: cabinForm.name, description: cabinForm.description,
      price: Number(cabinForm.price), maxGuests: Number(cabinForm.maxGuests),
      photos: cabinForm.photos,
      workStart: cabinForm.workStart, workEnd: cabinForm.workEnd, slotDuration: Number(cabinForm.slotDuration),
    };
    saveCabin(c);
    setShowAddCabin(false);
    setCabinForm({ name: '', description: '', price: '', maxGuests: '', photos: [], workStart: '09:00', workEnd: '21:00', slotDuration: '2' });
    refreshCabinsAndSlots();
    setSelectedCabin(c.id);
    toast.success('Кабинка добавлена!');
  };

  const handleEditCabin = () => {
    if (!editCabinData) return;
    updateCabin({
      ...editCabinData, name: cabinForm.name, description: cabinForm.description,
      price: Number(cabinForm.price), maxGuests: Number(cabinForm.maxGuests),
      photos: cabinForm.photos.length > 0 ? cabinForm.photos : editCabinData.photos,
      workStart: cabinForm.workStart, workEnd: cabinForm.workEnd, slotDuration: Number(cabinForm.slotDuration),
    });
    setEditCabinData(null);
    setCabinForm({ name: '', description: '', price: '', maxGuests: '', photos: [], workStart: '09:00', workEnd: '21:00', slotDuration: '2' });
    refreshCabinsAndSlots();
    toast.success('Кабинка обновлена');
  };

  const handleDeleteCabin = (id: string) => {
    deleteCabin(id);
    if (selectedCabin === id) setSelectedCabin('');
    refreshCabinsAndSlots();
    toast.success('Кабинка удалена');
  };

  const handleToggleSlot = (slot: TimeSlot) => {
    if (slot.status === 'free') {
      bookSlot(slot);
      toast.success('Слот отмечен как занятый');
    } else {
      unbookSlot(slot.cabinId, slot.date, slot.startTime);
      toast.success('Слот освобождён');
    }
    refreshSlots();
  };

  const handleConfirm = (bookingId: string) => {
    updateBookingStatus(bookingId, 'confirmed');
    refreshCabinsAndSlots();
    toast.success('Бронь подтверждена');
  };

  const handleReject = (bookingId: string) => {
    updateBookingStatus(bookingId, 'rejected');
    refreshCabinsAndSlots();
    toast.success('Бронь отклонена');
  };

  if (!user || (user.role !== 'owner' && user.role !== 'admin')) return <Navigate to="/auth" />;

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
  };
  const getDayName = (d: string) => DAYS[new Date(d + 'T00:00:00').getDay()];

  const currentCabin = cabins.find(c => c.id === selectedCabin);
  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  // Client bookings for mini-CRM dialog
  const clientBookings = selectedClient
    ? bookings.filter(b => b.clientId === selectedClient.clientId)
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Кабинет владельца</h1>
        <Button onClick={() => setShowAddBh(true)} className="gap-1.5"><Plus className="h-4 w-4" />Добавить заведение</Button>
      </div>

      {myBathhouses.length > 0 && (
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Заведение</Label>
            <Select value={selectedBh} onValueChange={v => { setSelectedBh(v); setSelectedCabin(''); }}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Выберите заведение" />
              </SelectTrigger>
              <SelectContent>
                {myBathhouses.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedBh && (
            <Button variant="outline" size="sm" onClick={openEditBh} className="gap-1.5">
              <Edit2 className="h-4 w-4" />Редактировать
            </Button>
          )}
        </div>
      )}

      {selectedBh && (
        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings" className="gap-1.5">
              Заявки
              {pendingCount > 0 && <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-[10px]">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="cabins">Кабинки ({cabins.length})</TabsTrigger>
            <TabsTrigger value="schedule">Расписание</TabsTrigger>
            <TabsTrigger value="clients">Клиенты</TabsTrigger>
          </TabsList>

          {/* Bookings/requests tab */}
          <TabsContent value="bookings">
            {bookings.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Пока нет заявок</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Клиент</th>
                      <th className="p-3">Телефон</th>
                      <th className="p-3">Кабинка</th>
                      <th className="p-3">Дата / Время</th>
                      <th className="p-3">Гостей</th>
                      <th className="p-3">Статус</th>
                      <th className="p-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => {
                      const cabin = getCabinById(b.cabinId);
                      const st = statusMap[b.status] || statusMap.pending;
                      return (
                        <tr key={b.id} ref={b.id === highlightId ? highlightRef : undefined} className={`border-b hover:bg-accent/30 ${b.id === highlightId ? 'bg-primary/10 animate-pulse' : ''}`}>
                          <td className="p-3">
                            <button
                              className="font-medium text-primary hover:underline"
                              onClick={() => setSelectedClient(b)}
                            >
                              {b.clientName}
                            </button>
                          </td>
                          <td className="p-3">{b.clientPhone || '—'}</td>
                          <td className="p-3">{cabin?.name || '—'}</td>
                          <td className="p-3">{formatDate(b.date)}, {b.startTime}–{b.endTime}</td>
                          <td className="p-3">{b.guests}</td>
                          <td className="p-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                          <td className="p-3">
                            {b.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="gap-1 h-8" onClick={() => handleConfirm(b.id)}>
                                  <Check className="h-3.5 w-3.5" />Подтвердить
                                </Button>
                                <Button size="sm" variant="destructive" className="gap-1 h-8" onClick={() => handleReject(b.id)}>
                                  <X className="h-3.5 w-3.5" />Отклонить
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Cabins tab */}
          <TabsContent value="cabins" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => {
                setCabinForm({ name: '', description: '', price: '', maxGuests: '', photos: [], workStart: '09:00', workEnd: '21:00', slotDuration: '2' });
                setShowAddCabin(true);
              }} className="gap-1.5">
                <Plus className="h-4 w-4" />Добавить кабинку
              </Button>
            </div>
            {cabins.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Нет кабинок. Добавьте первую!</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cabins.map(c => (
                  <Card key={c.id} className={`cursor-pointer transition-all ${selectedCabin === c.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedCabin(c.id)}>
                    {c.photos[0] && (
                      <div className="aspect-[16/10] overflow-hidden rounded-t-lg">
                        <img src={c.photos[0]} alt={c.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        {c.name}
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={(e) => {
                            e.stopPropagation();
                            setEditCabinData(c);
                            setCabinForm({ name: c.name, description: c.description, price: String(c.price), maxGuests: String(c.maxGuests), photos: c.photos, workStart: c.workStart, workEnd: c.workEnd, slotDuration: String(c.slotDuration) });
                          }}><Edit2 className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteCabin(c.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p className="text-muted-foreground">{c.description}</p>
                      <div className="flex justify-between pt-1">
                        <span>до {c.maxGuests} чел.</span>
                        <span className="font-semibold text-primary">{c.price.toLocaleString()} ₸</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Работает: {c.workStart}–{c.workEnd}, сеанс {c.slotDuration} ч.
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Schedule tab */}
          <TabsContent value="schedule" className="space-y-4">
            {cabins.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Сначала добавьте кабинку</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Кабинка</Label>
                    <Select value={selectedCabin} onValueChange={setSelectedCabin}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Выберите кабинку" />
                      </SelectTrigger>
                      <SelectContent>
                        {cabins.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name} (до {c.maxGuests} чел.)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {currentCabin && (
                    <div className="text-sm text-muted-foreground">
                      Рабочее время: {currentCabin.workStart}–{currentCabin.workEnd}, сеанс {currentCabin.slotDuration} ч.
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  Все слоты в рабочее время свободны по умолчанию. Нажмите на кнопку, чтобы отметить слот как занятый или освободить его.
                </p>

                {selectedCabin && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-3">Дата</th>
                          <th className="p-3">День</th>
                          <th className="p-3">Время</th>
                          <th className="p-3">Статус</th>
                          <th className="p-3">Макс. чел.</th>
                          <th className="p-3">Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map(s => (
                          <tr key={s.id} className="border-b hover:bg-accent/30">
                            <td className="p-3 font-medium">{formatDate(s.date)}</td>
                            <td className="p-3">{getDayName(s.date)}</td>
                            <td className="p-3 font-mono">{s.startTime}–{s.endTime}</td>
                            <td className="p-3">
                              <Badge variant={s.status === 'free' ? 'default' : 'secondary'}>
                                {s.status === 'free' ? 'Свободно' : 'Занято'}
                              </Badge>
                            </td>
                            <td className="p-3">до {s.maxGuests}</td>
                            <td className="p-3">
                              <Button
                                size="sm"
                                variant={s.status === 'free' ? 'outline' : 'default'}
                                onClick={() => handleToggleSlot(s)}
                                className="gap-1.5"
                              >
                                {s.status === 'free' ? (
                                  <><Lock className="h-3.5 w-3.5" />Занять</>
                                ) : (
                                  <><Unlock className="h-3.5 w-3.5" />Отменить слот</>
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {slots.length === 0 && <p className="py-8 text-center text-muted-foreground">Нет слотов. Настройте рабочее время кабинки.</p>}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="clients">
            <ClientsTab bookings={bookings} />
          </TabsContent>
        </Tabs>
      )}

      {myBathhouses.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">Добавьте своё первое заведение</p>
      )}

      {/* Client CRM dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Карточка клиента</DialogTitle></DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{selectedClient.clientName}</p>
                  {selectedClient.clientPhone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />{selectedClient.clientPhone}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Все бронирования ({clientBookings.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {clientBookings.map(b => {
                    const cabin = getCabinById(b.cabinId);
                    const st = statusMap[b.status] || statusMap.pending;
                    return (
                      <div key={b.id} className="rounded-lg border p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{cabin?.name || '—'}</span>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </div>
                        <p className="text-muted-foreground">{formatDate(b.date)}, {b.startTime}–{b.endTime}, {b.guests} чел.</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add bathhouse dialog */}
      <Dialog open={showAddBh} onOpenChange={setShowAddBh}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Добавить заведение</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Название</Label><Input value={bhForm.name} onChange={e => setBhForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Адрес</Label><Input value={bhForm.address} onChange={e => setBhForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Описание</Label><Textarea value={bhForm.description} onChange={e => setBhForm(p => ({ ...p, description: e.target.value }))} /></div>
            <BathhouseContactFields values={bhForm} onChange={(field, value) => setBhForm(p => ({ ...p, [field]: value }))} />
            <LocationPicker
              lat={parseFloat(bhForm.lat) || 51.1284}
              lng={parseFloat(bhForm.lng) || 71.4306}
              onChange={(lat, lng) => setBhForm(p => ({ ...p, lat: String(lat), lng: String(lng) }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Широта</Label><Input type="number" step="0.0001" value={bhForm.lat} onChange={e => setBhForm(p => ({ ...p, lat: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Долгота</Label><Input type="number" step="0.0001" value={bhForm.lng} onChange={e => setBhForm(p => ({ ...p, lng: e.target.value }))} /></div>
            </div>
            <PhotoUpload photos={bhForm.photos} onChange={photos => setBhForm(p => ({ ...p, photos }))} max={5} label="Фотографии заведения" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBh(false)}>Отмена</Button>
            <Button onClick={handleAddBh} disabled={!bhForm.name || !bhForm.address}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit bathhouse dialog */}
      <Dialog open={!!editBhData} onOpenChange={(o) => { if (!o) setEditBhData(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Редактировать заведение</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Название</Label><Input value={bhForm.name} onChange={e => setBhForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Адрес</Label><Input value={bhForm.address} onChange={e => setBhForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Описание</Label><Textarea value={bhForm.description} onChange={e => setBhForm(p => ({ ...p, description: e.target.value }))} /></div>
            <BathhouseContactFields values={bhForm} onChange={(field, value) => setBhForm(p => ({ ...p, [field]: value }))} />
            <LocationPicker
              lat={parseFloat(bhForm.lat) || 51.1284}
              lng={parseFloat(bhForm.lng) || 71.4306}
              onChange={(lat, lng) => setBhForm(p => ({ ...p, lat: String(lat), lng: String(lng) }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Широта</Label><Input type="number" step="0.0001" value={bhForm.lat} onChange={e => setBhForm(p => ({ ...p, lat: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Долгота</Label><Input type="number" step="0.0001" value={bhForm.lng} onChange={e => setBhForm(p => ({ ...p, lng: e.target.value }))} /></div>
            </div>
            <PhotoUpload photos={bhForm.photos} onChange={photos => setBhForm(p => ({ ...p, photos }))} max={5} label="Фотографии заведения" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBhData(null)}>Отмена</Button>
            <Button onClick={handleEditBh} disabled={!bhForm.name || !bhForm.address}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit cabin dialog */}
      <Dialog open={showAddCabin || !!editCabinData} onOpenChange={() => { setShowAddCabin(false); setEditCabinData(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCabinData ? 'Редактировать кабинку' : 'Добавить кабинку'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Название</Label><Input value={cabinForm.name} onChange={e => setCabinForm(p => ({ ...p, name: e.target.value }))} placeholder='Например: "VIP кабинка"' /></div>
            <div className="space-y-1"><Label>Описание</Label><Textarea value={cabinForm.description} onChange={e => setCabinForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Цена (₸)</Label><Input type="number" value={cabinForm.price} onChange={e => setCabinForm(p => ({ ...p, price: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Макс. чел.</Label><Input type="number" value={cabinForm.maxGuests} onChange={e => setCabinForm(p => ({ ...p, maxGuests: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Начало работы</Label><Input type="time" value={cabinForm.workStart} onChange={e => setCabinForm(p => ({ ...p, workStart: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Конец работы</Label><Input type="time" value={cabinForm.workEnd} onChange={e => setCabinForm(p => ({ ...p, workEnd: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Сеанс (ч.)</Label><Input type="number" min="1" max="6" value={cabinForm.slotDuration} onChange={e => setCabinForm(p => ({ ...p, slotDuration: e.target.value }))} /></div>
            </div>
            <PhotoUpload photos={cabinForm.photos} onChange={photos => setCabinForm(p => ({ ...p, photos }))} max={5} label="Фотографии кабинки" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddCabin(false); setEditCabinData(null); }}>Отмена</Button>
            <Button onClick={editCabinData ? handleEditCabin : handleAddCabin} disabled={!cabinForm.name || !cabinForm.price}>
              {editCabinData ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerDashboard;

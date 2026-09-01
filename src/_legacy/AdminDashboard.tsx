import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/useAuth';
import { getBathhouses, saveBathhouse, updateBathhouse, getCabinsByBathhouse, saveCabin, updateCabin, deleteCabin, getCabinById, getBookingsByBathhouse, getUsersByRole, getBookings, updateBookingStatus } from '@/lib/store';
import { Bathhouse, Cabin, Booking, User } from '@/lib/types';
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
import { Plus, Trash2, Edit2, Shield, Search, LogIn, Users, Check, X, Phone, User as UserIcon, MapPin } from 'lucide-react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import LocationPicker from '@/components/LocationPicker';
import ClientsTab from '@/components/ClientsTab';
import PhotoUpload from '@/components/PhotoUpload';
import BathhouseContactFields from '@/components/BathhouseContactFields';
import { subscribeToStoreUpdates } from '@/lib/store-events';
import { fetchAdminCloudBookings, updateCloudBookingStatus } from '@/lib/cloud-bookings';

const AdminBathhouseSearch = ({ bathhouses, searchQuery, setSearchQuery, onSelect }: {
  bathhouses: Bathhouse[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelect: (id: string) => void;
}) => {
  const [showResults, setShowResults] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const results = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return bathhouses.filter(b =>
      b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [bathhouses, searchQuery]);

  return (
    <div className="relative max-w-md z-[100]" ref={ref}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
      <Input
        placeholder="Поиск заведения по названию или адресу..."
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); setShowResults(true); }}
        onFocus={() => setShowResults(true)}
        className="pl-9"
      />
      {showResults && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-popover shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          {results.map(b => (
            <button
              key={b.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors w-full text-left"
              onClick={() => { onSelect(b.id); setShowResults(false); }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{b.name}</p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {b.address}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {showResults && searchQuery.length >= 2 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-popover shadow-lg p-4 text-center text-sm text-muted-foreground">
          Ничего не найдено
        </div>
      )}
    </div>
  );
};

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const statusMap = {
  pending: { label: 'Ожидает', variant: 'secondary' as const },
  confirmed: { label: 'Подтверждена', variant: 'default' as const },
  rejected: { label: 'Отклонена', variant: 'destructive' as const },
};

const AdminDashboard = () => {
  const { user, loginAs } = useAuth();
  const navigate = useNavigate();
  const [owners, setOwners] = useState<User[]>([]);
  const [allBathhouses, setAllBathhouses] = useState<Bathhouse[]>([]);
  const [selectedBh, setSelectedBh] = useState<string>('');
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [selectedClient, setSelectedClient] = useState<Booking | null>(null);

  // Filters
  const [filterVenue, setFilterVenue] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  const [showBhDialog, setShowBhDialog] = useState(false);
  const [editBhData, setEditBhData] = useState<Bathhouse | null>(null);
  const [bhForm, setBhForm] = useState({ name: '', address: '', description: '', link: '', phone: '', email: '', website: '', instagram: '', whatsapp: '', photos: [] as string[], lat: '51.1284', lng: '71.4306' });

  const [showCabinDialog, setShowCabinDialog] = useState(false);
  const [editCabinData, setEditCabinData] = useState<Cabin | null>(null);
  const [cabinForm, setCabinForm] = useState({ name: '', description: '', price: '', maxGuests: '', photos: [] as string[], workStart: '09:00', workEnd: '21:00', slotDuration: '2' });

  const mergeBookings = (localBookings: Booking[], cloudBookings: Booking[] = []) => {
    const map = new Map<string, Booking>();
    localBookings.forEach(b => map.set(b.id, b));
    cloudBookings.forEach(b => map.set(b.id, b));
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };

  const refreshBookings = async () => {
    const localBookings = getBookings();
    setAllBookings(mergeBookings(localBookings));
    if (selectedBh) {
      setBookings(mergeBookings(localBookings.filter(b => b.bathhouseId === selectedBh)));
    }

    if (!user || user.role !== 'admin') return;

    try {
      const cloudBookings = await fetchAdminCloudBookings({ email: user.email, password: user.password });
      const merged = mergeBookings(localBookings, cloudBookings);
      setAllBookings(merged);
      if (selectedBh) {
        setBookings(merged.filter(b => b.bathhouseId === selectedBh));
      }
    } catch (error) {
      console.error('[CloudBookings] Failed to fetch admin bookings:', error);
    }
  };

  const refresh = () => {
    const bhs = getBathhouses();
    setAllBathhouses(bhs);
    if (bhs.length > 0 && !selectedBh) setSelectedBh(bhs[0].id);
    setOwners(getUsersByRole('owner'));
    refreshBookings();
  };

  useEffect(() => { refresh(); }, [user]);

  useEffect(() => {
    if (selectedBh) {
      setCabins(getCabinsByBathhouse(selectedBh));
      setBookings(getBookingsByBathhouse(selectedBh).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      refreshBookings();
    }
  }, [selectedBh]);

  useEffect(() => {
    const unsub = subscribeToStoreUpdates(() => {
      refreshBookings();
      setAllBathhouses(getBathhouses());
      setOwners(getUsersByRole('owner'));
      if (selectedBh) {
        setCabins(getCabinsByBathhouse(selectedBh));
      }
    });
    const interval = window.setInterval(refreshBookings, 5000);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, [selectedBh, user]);

  const refreshCabins = () => {
    setCabins(getCabinsByBathhouse(selectedBh));
    setBookings(getBookingsByBathhouse(selectedBh).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    refreshBookings();
  };

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
  };
  const getDayName = (d: string) => DAYS[new Date(d + 'T00:00:00').getDay()];

  const openAddBh = () => {
    setEditBhData(null);
    setBhForm({ name: '', address: '', description: '', link: '', phone: '', email: '', website: '', instagram: '', whatsapp: '', photos: [], lat: '51.1284', lng: '71.4306' });
    setShowBhDialog(true);
  };

  const openEditBh = (bh: Bathhouse) => {
    setEditBhData(bh);
    setBhForm({
      name: bh.name, address: bh.address, description: bh.description, link: bh.link || '',
      phone: bh.phone || '', email: bh.email || '', website: bh.website || '',
      instagram: bh.instagram || '', whatsapp: bh.whatsapp || '',
      photos: [...bh.photos], lat: String(bh.lat || '51.1284'), lng: String(bh.lng || '71.4306'),
    });
    setShowBhDialog(true);
  };

  const handleSaveBh = () => {
    if (editBhData) {
      updateBathhouse({
        ...editBhData, name: bhForm.name, address: bhForm.address, description: bhForm.description,
        link: bhForm.link || undefined, phone: bhForm.phone || undefined, email: bhForm.email || undefined,
        website: bhForm.website || undefined, instagram: bhForm.instagram || undefined, whatsapp: bhForm.whatsapp || undefined,
        photos: bhForm.photos.length > 0 ? bhForm.photos : editBhData.photos,
        lat: parseFloat(bhForm.lat) || undefined, lng: parseFloat(bhForm.lng) || undefined,
      });
      toast.success('Заведение обновлено');
    } else {
      const bh: Bathhouse = {
        id: crypto.randomUUID(), ownerId: user!.id,
        name: bhForm.name, address: bhForm.address, description: bhForm.description,
        link: bhForm.link || undefined, phone: bhForm.phone || undefined, email: bhForm.email || undefined,
        website: bhForm.website || undefined, instagram: bhForm.instagram || undefined, whatsapp: bhForm.whatsapp || undefined,
        photos: bhForm.photos,
        lat: parseFloat(bhForm.lat) || undefined, lng: parseFloat(bhForm.lng) || undefined,
      };
      saveBathhouse(bh);
      setSelectedBh(bh.id);
      toast.success('Заведение добавлено!');
    }
    setShowBhDialog(false);
    refresh();
  };

  const openAddCabin = () => {
    setEditCabinData(null);
    setCabinForm({ name: '', description: '', price: '', maxGuests: '', photos: [], workStart: '09:00', workEnd: '21:00', slotDuration: '2' });
    setShowCabinDialog(true);
  };

  const openEditCabin = (c: Cabin) => {
    setEditCabinData(c);
    setCabinForm({ name: c.name, description: c.description, price: String(c.price), maxGuests: String(c.maxGuests), photos: [...c.photos], workStart: c.workStart, workEnd: c.workEnd, slotDuration: String(c.slotDuration) });
    setShowCabinDialog(true);
  };

  const handleSaveCabin = () => {
    if (editCabinData) {
      updateCabin({
        ...editCabinData, name: cabinForm.name, description: cabinForm.description,
        price: Number(cabinForm.price), maxGuests: Number(cabinForm.maxGuests),
        photos: cabinForm.photos.length > 0 ? cabinForm.photos : editCabinData.photos,
        workStart: cabinForm.workStart, workEnd: cabinForm.workEnd, slotDuration: Number(cabinForm.slotDuration),
      });
      toast.success('Кабинка обновлена');
    } else {
      const c: Cabin = {
        id: crypto.randomUUID(), bathhouseId: selectedBh,
        name: cabinForm.name, description: cabinForm.description,
        price: Number(cabinForm.price), maxGuests: Number(cabinForm.maxGuests),
        photos: cabinForm.photos,
        workStart: cabinForm.workStart, workEnd: cabinForm.workEnd, slotDuration: Number(cabinForm.slotDuration),
      };
      saveCabin(c);
      toast.success('Кабинка добавлена!');
    }
    setShowCabinDialog(false);
    refreshCabins();
  };

  const handleDeleteCabin = (id: string) => {
    deleteCabin(id);
    refreshCabins();
    toast.success('Кабинка удалена');
  };

  const setBookingStatusInView = (bookingId: string, status: Booking['status']) => {
    setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
  };

  const handleConfirm = (bookingId: string) => {
    updateBookingStatus(bookingId, 'confirmed');
    if (user) {
      updateCloudBookingStatus({ email: user.email, password: user.password }, bookingId, 'confirmed')
        .then(refreshBookings)
        .catch(error => console.error('[CloudBookings] Failed to confirm booking:', error));
    }
    setBookingStatusInView(bookingId, 'confirmed');
    refreshCabins();
    toast.success('Бронь подтверждена');
  };

  const handleReject = (bookingId: string) => {
    updateBookingStatus(bookingId, 'rejected');
    if (user) {
      updateCloudBookingStatus({ email: user.email, password: user.password }, bookingId, 'rejected')
        .then(refreshBookings)
        .catch(error => console.error('[CloudBookings] Failed to reject booking:', error));
    }
    setBookingStatusInView(bookingId, 'rejected');
    refreshCabins();
    toast.success('Бронь отклонена');
  };

  if (!user || user.role !== 'admin') return <Navigate to="/auth" />;

  // Filtered all bookings
  const filteredBookings = allBookings.filter(b => {
    if (filterVenue !== 'all' && b.bathhouseId !== filterVenue) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (filterDate && b.date !== filterDate) return false;
    return true;
  });

  // All unique clients across all bookings
  const allClients = (() => {
    const map = new Map<string, { clientId: string; clientName: string; clientPhone: string; bookingCount: number; venues: Set<string> }>();
    allBookings.forEach(b => {
      const existing = map.get(b.clientId);
      if (existing) {
        existing.bookingCount++;
        const bhName = allBathhouses.find(bh => bh.id === b.bathhouseId)?.name;
        if (bhName) existing.venues.add(bhName);
      } else {
        const bhName = allBathhouses.find(bh => bh.id === b.bathhouseId)?.name || '';
        map.set(b.clientId, { clientId: b.clientId, clientName: b.clientName, clientPhone: b.clientPhone || '', bookingCount: 1, venues: new Set(bhName ? [bhName] : []) });
      }
    });
    return Array.from(map.values());
  })();

  const clientBookingsForDialog = selectedClient
    ? allBookings.filter(b => b.clientId === selectedClient.clientId)
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Панель администратора</h1>
        </div>
        <Button onClick={openAddBh} className="gap-1.5"><Plus className="h-4 w-4" />Добавить заведение</Button>
      </div>

      {allBathhouses.length > 0 && (
        <div className="mb-6 space-y-3">
          <AdminBathhouseSearch
            bathhouses={allBathhouses}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSelect={(id) => { setSelectedBh(id); setSearchQuery(''); }}
          />
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1 flex-1 max-w-xs">
              <Label className="text-xs text-muted-foreground">Заведение</Label>
              <Select value={selectedBh} onValueChange={setSelectedBh}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите заведение" />
                </SelectTrigger>
                <SelectContent>
                  {allBathhouses.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name} — {b.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBh && (
              <Button variant="outline" size="sm" onClick={() => openEditBh(allBathhouses.find(b => b.id === selectedBh)!)} className="gap-1.5">
                <Edit2 className="h-4 w-4" />Редактировать
              </Button>
            )}
          </div>
        </div>
      )}

      {selectedBh && (
        <Tabs defaultValue="all-bookings">
          <TabsList className="flex-wrap">
            <TabsTrigger value="all-bookings">Все бронирования ({allBookings.length})</TabsTrigger>
            <TabsTrigger value="cabins">Кабинки ({cabins.length})</TabsTrigger>
            <TabsTrigger value="all-clients">База клиентов ({allClients.length})</TabsTrigger>
            <TabsTrigger value="clients">Клиенты заведения</TabsTrigger>
            <TabsTrigger value="owners">
              <Users className="h-4 w-4 mr-1" />Владельцы ({owners.length})
            </TabsTrigger>
          </TabsList>

          {/* All bookings with filters */}
          <TabsContent value="all-bookings" className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Заведение</Label>
                <Select value={filterVenue} onValueChange={setFilterVenue}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все заведения</SelectItem>
                    {allBathhouses.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Статус</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="confirmed">Подтверждена</SelectItem>
                    <SelectItem value="rejected">Отклонена</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Дата</Label>
                <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-44" />
              </div>
              {(filterVenue !== 'all' || filterStatus !== 'all' || filterDate) && (
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={() => { setFilterVenue('all'); setFilterStatus('all'); setFilterDate(''); }}>
                    Сбросить
                  </Button>
                </div>
              )}
            </div>

            {filteredBookings.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Нет бронирований</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Клиент</th>
                      <th className="p-3">Телефон</th>
                      <th className="p-3">Заведение</th>
                      <th className="p-3">Кабинка</th>
                      <th className="p-3">Дата / Время</th>
                      <th className="p-3">Гостей</th>
                      <th className="p-3">Статус</th>
                      <th className="p-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map(b => {
                      const cabin = getCabinById(b.cabinId);
                      const bh = allBathhouses.find(x => x.id === b.bathhouseId);
                      const st = statusMap[b.status] || statusMap.pending;
                      return (
                        <tr key={b.id} className="border-b hover:bg-accent/30">
                          <td className="p-3">
                            <button className="font-medium text-primary hover:underline" onClick={() => setSelectedClient(b)}>
                              {b.clientName}
                            </button>
                          </td>
                          <td className="p-3">{b.clientPhone || '—'}</td>
                          <td className="p-3 text-muted-foreground">{bh?.name || '—'}</td>
                          <td className="p-3">{cabin?.name || '—'}</td>
                          <td className="p-3">{formatDate(b.date)}, {b.startTime}–{b.endTime}</td>
                          <td className="p-3">{b.guests}</td>
                          <td className="p-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                          <td className="p-3">
                            {b.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="gap-1 h-8" onClick={() => handleConfirm(b.id)}>
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="destructive" className="gap-1 h-8" onClick={() => handleReject(b.id)}>
                                  <X className="h-3.5 w-3.5" />
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

          <TabsContent value="cabins" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={openAddCabin} className="gap-1.5"><Plus className="h-4 w-4" />Добавить кабинку</Button>
            </div>
            {cabins.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Нет кабинок</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cabins.map(c => (
                  <Card key={c.id}>
                    {c.photos[0] && (
                      <div className="aspect-[16/10] overflow-hidden rounded-t-lg">
                        <img src={c.photos[0]} alt={c.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        {c.name}
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditCabin(c)}><Edit2 className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteCabin(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p className="text-muted-foreground">{c.description}</p>
                      <div className="flex justify-between pt-1">
                        <span>до {c.maxGuests} чел.</span>
                        <span className="font-semibold text-primary">{c.price.toLocaleString()} ₸</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{c.workStart}–{c.workEnd}, сеанс {c.slotDuration} ч.</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Global client database */}
          <TabsContent value="all-clients">
            {allClients.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Нет клиентов</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Клиент</th>
                      <th className="p-3">Телефон</th>
                      <th className="p-3">Бронирований</th>
                      <th className="p-3">Заведения</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allClients.map(c => (
                      <tr key={c.clientId} className="border-b hover:bg-accent/30">
                        <td className="p-3 font-medium">{c.clientName}</td>
                        <td className="p-3">{c.clientPhone || '—'}</td>
                        <td className="p-3"><Badge variant="secondary">{c.bookingCount}</Badge></td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {Array.from(c.venues).map(v => <Badge key={v} variant="outline" className="text-xs">{v}</Badge>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="clients">
            <ClientsTab bookings={bookings} />
          </TabsContent>

          <TabsContent value="owners">
            {owners.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Нет зарегистрированных владельцев</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {owners.map(o => {
                  const ownerBhs = allBathhouses.filter(b => b.ownerId === o.id);
                  return (
                    <Card key={o.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{o.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <p className="text-muted-foreground">{o.email}</p>
                        <p>Заведений: <strong>{ownerBhs.length}</strong></p>
                        {ownerBhs.length > 0 && (
                          <ul className="text-xs text-muted-foreground list-disc pl-4">
                            {ownerBhs.map(b => <li key={b.id}>{b.name}</li>)}
                          </ul>
                        )}
                        <Button
                          size="sm" variant="outline" className="w-full gap-1.5 mt-2"
                          onClick={() => { loginAs(o); navigate('/owner'); toast.success(`Вы вошли как ${o.name}`); }}
                        >
                          <LogIn className="h-3.5 w-3.5" />Войти как владелец
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {allBathhouses.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">Нет заведений. Добавьте первое!</p>
      )}

      {/* Client CRM dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Карточка клиента</DialogTitle></DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <UserIcon className="h-5 w-5 text-primary" />
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
                <h4 className="font-medium mb-2">Все бронирования ({clientBookingsForDialog.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {clientBookingsForDialog.map(b => {
                    const cabin = getCabinById(b.cabinId);
                    const bh = allBathhouses.find(x => x.id === b.bathhouseId);
                    const st = statusMap[b.status] || statusMap.pending;
                    return (
                      <div key={b.id} className="rounded-lg border p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{bh?.name} — {cabin?.name || '—'}</span>
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

      {/* Bathhouse dialog */}
      <Dialog open={showBhDialog} onOpenChange={setShowBhDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editBhData ? 'Редактировать заведение' : 'Добавить заведение'}</DialogTitle></DialogHeader>
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
            <PhotoUpload photos={bhForm.photos} onChange={photos => setBhForm(p => ({ ...p, photos }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBhDialog(false)}>Отмена</Button>
            <Button onClick={handleSaveBh} disabled={!bhForm.name || !bhForm.address}>{editBhData ? 'Сохранить' : 'Добавить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cabin dialog */}
      <Dialog open={showCabinDialog} onOpenChange={setShowCabinDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCabinData ? 'Редактировать кабинку' : 'Добавить кабинку'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Название</Label><Input value={cabinForm.name} onChange={e => setCabinForm(p => ({ ...p, name: e.target.value }))} /></div>
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
            <PhotoUpload photos={cabinForm.photos} onChange={photos => setCabinForm(p => ({ ...p, photos }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCabinDialog(false)}>Отмена</Button>
            <Button onClick={handleSaveCabin} disabled={!cabinForm.name || !cabinForm.price}>
              {editCabinData ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;

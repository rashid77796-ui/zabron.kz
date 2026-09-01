import { User, Bathhouse, Cabin, TimeSlot, Booking, BookingStatus } from './types';
import seedBathhouses from '@/data/bathhouses-seed';

const get = <T>(key: string, fallback: T): T => {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch { return fallback; }
};
const set = (key: string, data: unknown) => {
  try {
    const json = JSON.stringify(data);
    try {
      localStorage.setItem(key, json);
    } catch (storageErr) {
      console.error(`[STORE] localStorage.setItem FAILED for key="${key}" (${(json.length / 1024).toFixed(1)} KB):`, storageErr);
      // Dispatch a custom event so UI can show a toast
      window.dispatchEvent(new CustomEvent('banya-store-error', { detail: { key, size: json.length, error: storageErr } }));
      return;
    }
    window.dispatchEvent(new Event('banya-store-updated'));
  } catch (e) {
    console.error('[STORE] JSON.stringify error:', e);
  }
};

// Users
export const getUsers = (): User[] => get('banya_users', []);
export const getUsersByRole = (role: string): User[] => getUsers().filter(u => u.role === role);
export const saveUser = (u: User) => { const all = getUsers(); all.push(u); set('banya_users', all); };
export const findUser = (email: string, password: string) => getUsers().find(u => u.email === email && (u as unknown as Record<string, unknown>).password === password);
export const findUserByEmail = (email: string) => getUsers().find(u => u.email === email);
export const getCurrentUser = (): User | null => get('banya_current_user', null);
export const setCurrentUser = (u: User | null) => set('banya_current_user', u);
export const getUserById = (id: string) => getUsers().find(u => u.id === id);
export const updateUser = (updated: User) => {
  const all = getUsers().map(u => u.id === updated.id ? updated : u);
  set('banya_users', all);
  const current = getCurrentUser();
  if (current && current.id === updated.id) setCurrentUser(updated);
};

// Notifications
export interface AppNotification {
  id: string;
  type: 'new_booking' | 'booking_confirmed' | 'booking_rejected';
  message: string;
  createdAt: string;
  read: boolean;
  bathhouseId?: string;
  userId?: string; // target user for client notifications
  bookingId?: string;
}
export const getNotifications = (): AppNotification[] => get('banya_notifications', []);
export const saveNotification = (n: AppNotification) => { const all = getNotifications(); all.unshift(n); set('banya_notifications', all); };
export const markNotificationRead = (id: string) => { set('banya_notifications', getNotifications().map(n => n.id === id ? { ...n, read: true } : n)); };
export const markAllNotificationsRead = () => { set('banya_notifications', getNotifications().map(n => ({ ...n, read: true }))); };
export const getNotificationsForUser = (userId: string): AppNotification[] => getNotifications().filter(n => n.userId === userId || !n.userId);

// Bathhouses
export const getBathhouses = (): Bathhouse[] => get('banya_bathhouses', []);
export const saveBathhouse = (b: Bathhouse) => { const all = getBathhouses(); all.push(b); set('banya_bathhouses', all); };
export const getBathhouseById = (id: string) => getBathhouses().find(b => b.id === id);
export const updateBathhouse = (b: Bathhouse) => {
  const all = getBathhouses().map(x => x.id === b.id ? b : x);
  set('banya_bathhouses', all);
};

// Cabins
export const getCabins = (): Cabin[] => get('banya_cabins', []);
export const getCabinsByBathhouse = (bathhouseId: string) => getCabins().filter(c => c.bathhouseId === bathhouseId);
export const getCabinById = (id: string) => getCabins().find(c => c.id === id);
export const saveCabin = (c: Cabin) => { const all = getCabins(); all.push(c); set('banya_cabins', all); };
export const updateCabin = (c: Cabin) => { set('banya_cabins', getCabins().map(x => x.id === c.id ? c : x)); };
export const deleteCabin = (id: string) => {
  set('banya_cabins', getCabins().filter(x => x.id !== id));
  set('banya_slots', getSlots().filter(s => s.cabinId !== id));
};

// Time Slots
export const getSlots = (): TimeSlot[] => get('banya_slots', []);
export const getSlotsByBathhouse = (id: string) => getSlots().filter(s => s.bathhouseId === id);
export const getSlotsByCabin = (cabinId: string) => getSlots().filter(s => s.cabinId === cabinId);
export const saveSlot = (s: TimeSlot) => { const all = getSlots(); all.push(s); set('banya_slots', all); };
export const updateSlot = (s: TimeSlot) => { set('banya_slots', getSlots().map(x => x.id === s.id ? s : x)); };
export const deleteSlot = (id: string) => { set('banya_slots', getSlots().filter(x => x.id !== id)); };

export const generateSlotsForCabin = (cabin: Cabin, days: number = 14): TimeSlot[] => {
  const bookedSlots = getSlotsByCabin(cabin.id);
  const result: TimeSlot[] = [];
  const today = new Date();

  const toMinutes = (time: unknown, fallback: string): number => {
    const fallbackParts = fallback.split(':').map(Number);
    const fallbackMinutes = (fallbackParts[0] || 0) * 60 + (fallbackParts[1] || 0);
    if (typeof time !== 'string') return fallbackMinutes;
    const parts = time.split(':');
    if (parts.length < 2) return fallbackMinutes;
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return fallbackMinutes;
    }
    return hour * 60 + minute;
  };

  const startMinutes = toMinutes(cabin.workStart, '09:00');
  let endMinutes = toMinutes(cabin.workEnd, '21:00');
  if (endMinutes <= startMinutes) endMinutes += 24 * 60; // overnight: e.g. 10:00–03:00

  const durationHours = Number(cabin.slotDuration);
  const slotDurationMinutes = Number.isFinite(durationHours) && durationHours > 0 ? Math.round(durationHours * 60) : 120;
  const maxGuests = Number(cabin.maxGuests) > 0 ? Number(cabin.maxGuests) : 1;

  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];

    for (let start = startMinutes; start + slotDurationMinutes <= endMinutes; start += slotDurationMinutes) {
      const end = start + slotDurationMinutes;
      const startTime = `${(Math.floor(start / 60) % 24).toString().padStart(2, '0')}:${(start % 60).toString().padStart(2, '0')}`;
      const endTime = `${(Math.floor(end / 60) % 24).toString().padStart(2, '0')}:${(end % 60).toString().padStart(2, '0')}`;
      const slotId = `${cabin.id}-${dateStr}-${startTime}`;
      const booked = bookedSlots.find(s => s.date === dateStr && s.startTime === startTime);

      result.push({
        id: booked?.id || slotId,
        cabinId: cabin.id,
        bathhouseId: cabin.bathhouseId,
        date: dateStr,
        startTime,
        endTime,
        maxGuests,
        status: booked ? 'booked' : 'free',
      });
    }
  }
  return result;
};

export const bookSlot = (slot: TimeSlot) => {
  const existing = getSlots().find(s => s.cabinId === slot.cabinId && s.date === slot.date && s.startTime === slot.startTime);
  if (existing) {
    updateSlot({ ...existing, status: 'booked' });
  } else {
    saveSlot({ ...slot, status: 'booked' });
  }
};

export const unbookSlot = (cabinId: string, date: string, startTime: string) => {
  const all = getSlots().filter(s => !(s.cabinId === cabinId && s.date === date && s.startTime === startTime));
  set('banya_slots', all);
};

// Bookings
export const getBookings = (): Booking[] => get('banya_bookings', []);
export const saveBooking = (b: Booking) => { const all = getBookings(); all.push(b); set('banya_bookings', all); };
export const updateBooking = (b: Booking) => { set('banya_bookings', getBookings().map(x => x.id === b.id ? b : x)); };
export const getBookingsByClient = (clientId: string) => getBookings().filter(b => b.clientId === clientId);
export const getBookingsByBathhouse = (bathhouseId: string) => getBookings().filter(b => b.bathhouseId === bathhouseId);
export const getBookingsByCabin = (cabinId: string) => getBookings().filter(b => b.cabinId === cabinId);

export const updateBookingStatus = (bookingId: string, status: BookingStatus) => {
  const booking = getBookings().find(b => b.id === bookingId);
  if (!booking) return;
  updateBooking({ ...booking, status });

  // If rejected, free the slot
  if (status === 'rejected') {
    unbookSlot(booking.cabinId, booking.date, booking.startTime);
  }

  // Notify client
  const bhName = getBathhouseById(booking.bathhouseId)?.name || '';
  const statusText = status === 'confirmed' ? 'подтверждена ✅' : 'отклонена ❌';
  saveNotification({
    id: crypto.randomUUID(),
    type: status === 'confirmed' ? 'booking_confirmed' : 'booking_rejected',
    message: `Ваша бронь в ${bhName} на ${booking.date} ${booking.startTime}–${booking.endTime} ${statusText}`,
    createdAt: new Date().toISOString(),
    read: false,
    userId: booking.clientId,
    bookingId: booking.id,
  });
};

// Seed data
const SEED_VERSION = '24'; // add Drovapar 2gis link
export const seedData = () => {
  const ownerId = 'owner-1';
  if (!getUsers().find(u => u.id === ownerId)) {
    saveUser({ id: ownerId, name: 'Иван Петров', email: 'owner@test.com', role: 'merchant', phone: '+7 777 123 4567' } as User);
  }
  const adminId = 'admin-1';
  if (!getUsers().find(u => u.id === adminId)) {
    saveUser({ id: adminId, name: 'Супер Админ', email: 'admin@test.com', role: 'super_admin', phone: '' } as User);
  }

  if (localStorage.getItem('banya_seed_version') === SEED_VERSION) return;

  localStorage.removeItem('banya_bathhouses');
  localStorage.removeItem('banya_cabins');
  localStorage.removeItem('banya_slots');
  localStorage.removeItem('banya_bookings');

  set('banya_bathhouses', seedBathhouses);

  // Generate 1 cabin per bathhouse
  const cabins: Cabin[] = seedBathhouses.map((b: Bathhouse) => ({
    id: `cabin-${b.id}`,
    bathhouseId: b.id,
    name: 'Основная кабинка',
    description: 'Уютная кабинка для отдыха',
    price: 5000,
    maxGuests: 6,
    photos: b.photos.length > 0 ? [b.photos[0]] : [],
    workStart: '10:00',
    workEnd: '03:00',
    slotDuration: 1,
  }));
  set('banya_cabins', cabins);
  localStorage.setItem('banya_seed_version', SEED_VERSION);
};

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBathhouseById, getCabinsByBathhouse, generateSlotsForCabin, bookSlot, saveBooking, saveNotification } from '@/lib/store';
import { subscribeToStoreUpdates } from '@/lib/store-events';
import { useAuth } from '@/lib/useAuth';
import { Bathhouse, Cabin, TimeSlot, Booking } from '@/lib/types';
import BookingCalendar from '@/components/BookingCalendar';
import BathhouseMap from '@/components/BathhouseMap';
import { MapPin, Users, Banknote, Film, Link as LinkIcon, Phone, Mail, Globe, Instagram, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { isVideo } from '@/lib/media';
import LinkedText from '@/components/LinkedText';
import PhotoLightbox from '@/components/PhotoLightbox';
import { submitBookingToGoogleForm } from '@/lib/google-form';
import { getGuestId } from '@/lib/guest';
import { saveCloudBooking } from '@/lib/cloud-bookings';

const BathhouseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [bathhouse, setBathhouse] = useState<Bathhouse | null>(null);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [selectedCabin, setSelectedCabin] = useState<string>('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [cabinLightboxOpen, setCabinLightboxOpen] = useState(false);
  const [cabinLightboxPhotos, setCabinLightboxPhotos] = useState<string[]>([]);
  const [cabinLightboxIndex, setCabinLightboxIndex] = useState(0);

  const openBathhousePhoto = (idx: number) => { setLightboxIndex(idx); setLightboxOpen(true); };
  const openCabinPhoto = (photos: string[], idx: number) => { setCabinLightboxPhotos(photos); setCabinLightboxIndex(idx); setCabinLightboxOpen(true); };

  useEffect(() => {
    if (!id) return;

    const refreshBathhouse = () => {
      setBathhouse(getBathhouseById(id) || null);
      const cbs = getCabinsByBathhouse(id);
      setCabins(cbs);
      setSelectedCabin(current => (cbs.find(c => c.id === current) ? current : cbs[0]?.id || ''));
    };

    refreshBathhouse();
    return subscribeToStoreUpdates(refreshBathhouse);
  }, [id]);

  useEffect(() => {
    if (selectedCabin) {
      const cabin = cabins.find(c => c.id === selectedCabin);
      if (cabin) {
        setSlots(generateSlotsForCabin(cabin));
      }
    }
  }, [selectedCabin, cabins]);

  const currentCabin = cabins.find(c => c.id === selectedCabin);

  const handleBook = (
    slot: TimeSlot,
    guests: number,
    endTime?: string,
    comment?: string,
    guestName?: string,
    guestPhone?: string,
  ) => {
    const clientName = user?.name || guestName || 'Гость';
    const clientPhone = user?.phone || guestPhone || '';
    const clientId = user?.id || getGuestId();

    const finalEndTime = endTime || slot.endTime;

    // Book all consecutive slots from startTime to finalEndTime
    const slotsToBook = slots.filter(s =>
      s.date === slot.date &&
      s.startTime >= slot.startTime &&
      s.endTime <= finalEndTime &&
      s.status === 'free'
    );

    slotsToBook.forEach(s => bookSlot(s));

    const bookingId = crypto.randomUUID();
    const booking: Booking = {
      id: bookingId,
      slotId: slot.id,
      cabinId: slot.cabinId,
      bathhouseId: slot.bathhouseId,
      clientId,
      clientName,
      clientPhone,
      guests,
      date: slot.date,
      startTime: slot.startTime,
      endTime: finalEndTime,
      status: 'pending',
      comment,
      createdAt: new Date().toISOString(),
    };

    saveBooking(booking);
    saveCloudBooking(booking).catch((error) => {
      console.error('[CloudBookings] Failed to save booking:', error);
      toast.error('Заявка сохранена на устройстве, но не дошла до админки', {
        description: 'Проверьте подключение к интернету и попробуйте ещё раз.',
      });
    });

    const cabinName = currentCabin?.name || '';
    const bhName = bathhouse?.name || '';
    saveNotification({
      id: crypto.randomUUID(),
      type: 'new_booking',
      message: `Новая заявка: ${clientName} — ${bhName}, ${cabinName}, ${slot.date} ${slot.startTime}–${finalEndTime}, ${guests} чел.`,
      createdAt: new Date().toISOString(),
      read: false,
      bathhouseId: slot.bathhouseId,
      bookingId,
    });

    if (user) {
      saveNotification({
        id: crypto.randomUUID(),
        type: 'new_booking',
        message: `Ваша заявка в ${bhName} (${cabinName}) на ${slot.date} ${slot.startTime}–${finalEndTime} принята и ожидает подтверждения`,
        createdAt: new Date().toISOString(),
        read: false,
        userId: user.id,
        bookingId,
      });
    }

    // Submit to Google Form
    submitBookingToGoogleForm({
      name: clientName,
      phone: clientPhone,
      bathhouse: `${bhName} — ${cabinName}`,
      date: slot.date,
      time: `${slot.startTime}–${finalEndTime}`,
      guests,
    });

    if (currentCabin) {
      setSlots(generateSlotsForCabin(currentCabin));
    }
    toast.success('Заявка отправлена!', {
      description: `${currentCabin?.name}: ${slot.date}, ${slot.startTime}–${finalEndTime}, ${guests} чел. Ожидайте подтверждения.`,
    });
  };

  if (!bathhouse) return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Баня не найдена</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="aspect-[21/9] max-h-64 overflow-hidden rounded-xl mb-4 relative cursor-pointer" onClick={() => openBathhousePhoto(0)}>
          {bathhouse.photos[0] && isVideo(bathhouse.photos[0]) ? (
            <video src={bathhouse.photos[0]} className="h-full w-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <img src={bathhouse.photos[0] || '/placeholder.svg'} alt={bathhouse.name} className="h-full w-full object-cover" />
          )}
        </div>
        {bathhouse.photos.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {bathhouse.photos.slice(1).map((src, i) => (
              <div key={i} className="h-20 w-28 shrink-0 rounded-lg overflow-hidden border relative cursor-pointer" onClick={() => openBathhousePhoto(i + 1)}>
                {isVideo(src) ? (
                  <>
                    <video src={src} className="h-full w-full object-cover" muted playsInline />
                    <div className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5">
                      <Film className="h-3 w-3 text-white" />
                    </div>
                  </>
                ) : (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-bold">{bathhouse.name}</h1>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
          <MapPin className="h-4 w-4" />{bathhouse.address}
        </div>
        <p className="text-muted-foreground leading-relaxed mt-2"><LinkedText text={bathhouse.description} /></p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
          {bathhouse.phone && (
            <a href={`tel:${bathhouse.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
              <Phone className="h-3.5 w-3.5" />{bathhouse.phone}
            </a>
          )}
          {bathhouse.email && (
            <a href={`mailto:${bathhouse.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
              <Mail className="h-3.5 w-3.5" />{bathhouse.email}
            </a>
          )}
          {bathhouse.website && (
            <a href={bathhouse.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <Globe className="h-3.5 w-3.5" />{bathhouse.website.replace(/^https?:\/\//, '').slice(0, 40)}
            </a>
          )}
          {bathhouse.instagram && (
            <a href={bathhouse.instagram.startsWith('http') ? bathhouse.instagram : `https://instagram.com/${bathhouse.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <Instagram className="h-3.5 w-3.5" />{bathhouse.instagram}
            </a>
          )}
          {bathhouse.whatsapp && (
            <a href={`https://wa.me/${bathhouse.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <MessageCircle className="h-3.5 w-3.5" />WhatsApp
            </a>
          )}
          {bathhouse.link && (
            <a href={bathhouse.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <LinkIcon className="h-3.5 w-3.5" />{bathhouse.link.replace(/^https?:\/\//, '').slice(0, 40)}
            </a>
          )}
        </div>

        {bathhouse.lat && bathhouse.lng && (
          <div className="mt-4">
            <BathhouseMap bathhouses={[bathhouse]} selectedId={bathhouse.id} />
          </div>
        )}
      </div>

      {cabins.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Нет доступных кабинок</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4">Выберите кабинку</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {cabins.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCabin(c.id)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  selectedCabin === c.id ? 'ring-2 ring-primary border-primary bg-accent/50' : 'hover:border-primary/50'
                }`}
              >
                {c.photos[0] && (
                  <div className="aspect-[16/10] overflow-hidden rounded-lg mb-3 relative cursor-pointer" onClick={(e) => { e.stopPropagation(); openCabinPhoto(c.photos, 0); }}>
                    {isVideo(c.photos[0]) ? (
                      <>
                        <video src={c.photos[0]} className="h-full w-full object-cover" muted playsInline />
                        <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5">
                          <Film className="h-3 w-3 text-white" />
                        </div>
                      </>
                    ) : (
                      <img src={c.photos[0]} alt={c.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                )}
                <h3 className="font-semibold">{c.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-3.5 w-3.5" />до {c.maxGuests} чел.</span>
                  <span className="flex items-center gap-1 font-semibold text-primary"><Banknote className="h-4 w-4" />{c.price.toLocaleString()} ₸</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Работает: {c.workStart}–{c.workEnd}, сеанс {c.slotDuration} ч.
                </div>
              </button>
            ))}
          </div>

          {currentCabin && (
            <div>
              <h2 className="mb-4 text-xl font-semibold">Календарь бронирования — {currentCabin.name}</h2>
              <BookingCalendar
                slots={slots}
                maxGuests={currentCabin.maxGuests}
                onBook={handleBook}
                requireGuestInfo={!user}
              />
            </div>
          )}
        </>
      )}
      {bathhouse.photos.length > 0 && (
        <PhotoLightbox photos={bathhouse.photos} initialIndex={lightboxIndex} open={lightboxOpen} onOpenChange={setLightboxOpen} />
      )}
      {cabinLightboxPhotos.length > 0 && (
        <PhotoLightbox photos={cabinLightboxPhotos} initialIndex={cabinLightboxIndex} open={cabinLightboxOpen} onOpenChange={setCabinLightboxOpen} />
      )}
    </div>
  );
};

export default BathhouseDetail;

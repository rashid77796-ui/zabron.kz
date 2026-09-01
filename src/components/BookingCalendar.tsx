'use client'

import { useState, useMemo, useEffect } from 'react';
import { TimeSlot } from '@/lib/types';
import { nowInVenueTz } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = (m: number) => `${(Math.floor(m / 60) % 24).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
// Normalize minutes for overnight comparison: times before 06:00 are treated as next-day
const normalizeMin = (m: number) => m < 360 ? m + 1440 : m;

interface BookingCalendarProps {
  slots: TimeSlot[];
  maxGuests: number;
  onBook: (slot: TimeSlot, guests: number, endTime?: string, comment?: string, guestName?: string, guestPhone?: string) => void;
  requireGuestInfo?: boolean;
  defaultGuests?: number;
  userPhone?: string | null;
  // Стоимость для окна подтверждения (правка #5)
  pricePerHour?: number | null;
  flatPrice?: number | null;
  discountPercent?: number;
  // Депозит/предоплата за бронь — заведение берёт его само (правка #51)
  bookingDeposit?: number | null;
}

const BookingCalendar = ({ slots, maxGuests, onBook, requireGuestInfo, defaultGuests, userPhone, pricePerHour, flatPrice, discountPercent = 0, bookingDeposit }: BookingCalendarProps) => {
  // «Сегодня» — в поясе заведения (Астана), а не браузера (правка #7)
  const todayStr = () => nowInVenueTz().date;
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ date: string; start: string; end: string; guests: number } | null>(null);
  const [guests, setGuests] = useState(defaultGuests && defaultGuests > 0 ? defaultGuests : 1);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [comment, setComment] = useState('');
  const [guestName, setGuestName] = useState('');
  // showPhoneInput: always for unauthenticated; for authenticated — only when no phone on profile yet
  const showPhoneInput = requireGuestInfo || !userPhone;
  const [guestPhone, setGuestPhone] = useState('+7');
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());

  const today = todayStr();
  const nowMin = nowInVenueTz().minutes; // текущее время в поясе заведения (правка #7)
  // Filter out past dates
  const dates = [...new Set(slots.map(s => s.date))].sort().filter(d => d >= today);
  const currentIdx = dates.indexOf(selectedDate);

  // Ночная граница берётся из самих слотов: первый слот выбранного дня — это время
  // открытия заведения. Для круглосуточного (открытие 00:00) граница = 0, поэтому
  // ночные слоты не переносятся и окно бронирования не упирается в 06:00 (баг #8).
  const dayStartMin = (() => {
    const raw = slots.filter(s => s.date === selectedDate);
    return raw.length ? toMin(raw[0].startTime) : 0;
  })();
  // Локальная версия перекрывает модульную normalizeMin с жёсткими 06:00.
  const normalizeMin = (m: number) => (m < dayStartMin ? m + 1440 : m);

  useEffect(() => {
    if (dates.length > 0 && !dates.includes(selectedDate)) {
      setSelectedDate(dates[0]);
    }
  }, [dates, selectedDate]);

  const isPastSlot = (date: string, startTime: string) => {
    if (date > today) return false;
    if (date < today) return true;
    // same day — block if start time already passed (treat overnight 00:00-06:00 as future)
    const sm = toMin(startTime);
    if (sm < dayStartMin) return false; // до открытия — следующий день (будущее)
    return sm <= nowMin;
  };

  const daySlots = slots
    .filter(s => s.date === selectedDate)
    .filter(s => !isPastSlot(s.date, s.startTime))
    .sort((a, b) => normalizeMin(toMin(a.startTime)) - normalizeMin(toMin(b.startTime)));
  const freeSlots = daySlots.filter(s => s.status === 'free');

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dayName = DAYS[dateObj.getDay()];
  const dateLabel = `${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]}`;

  // Build free time ranges (consecutive free slots merged, overnight-aware)
  const freeRanges = useMemo(() => {
    const ranges: { start: string; end: string }[] = [];
    let rangeStart = '';
    let rangeEnd = '';
    for (const s of freeSlots) {
      if (!rangeStart || normalizeMin(toMin(s.startTime)) !== normalizeMin(toMin(rangeEnd))) {
        if (rangeStart) ranges.push({ start: rangeStart, end: rangeEnd });
        rangeStart = s.startTime;
      }
      rangeEnd = s.endTime;
    }
    if (rangeStart) ranges.push({ start: rangeStart, end: rangeEnd });
    return ranges;
  }, [freeSlots]);

  // Generate available start times (every 30 min within free ranges, overnight-aware)
  const startOptions = useMemo(() => {
    const opts: string[] = [];
    for (const r of freeRanges) {
      const start0 = normalizeMin(toMin(r.start));
      let end = normalizeMin(toMin(r.end));
      if (end <= start0) end += 1440; // полный день / переход через полночь
      let m = start0;
      while (m < end) {
        opts.push(fromMin(m));
        m += 30;
      }
    }
    return opts;
  }, [freeRanges]);

  // Generate available end times based on selected start — no minimum restriction
  const endOptions = useMemo(() => {
    if (!startTime) return [];
    const startM = normalizeMin(toMin(startTime));
    const range = freeRanges.find(r => {
      const rs = normalizeMin(toMin(r.start));
      let re = normalizeMin(toMin(r.end));
      if (re <= rs) re += 1440; // полный день / переход через полночь
      return rs <= startM && startM < re;
    });
    if (!range) return [];
    const opts: string[] = [];
    let m = startM + 30;
    let end = normalizeMin(toMin(range.end));
    if (end <= normalizeMin(toMin(range.start))) end += 1440;
    while (m <= end) {
      opts.push(fromMin(m));
      m += 30;
    }
    return opts;
  }, [startTime, freeRanges]);

  // Check if slots form a consecutive block
  const areConsecutive = (ids: Set<string>) => {
    if (ids.size <= 1) return true;
    const selected = freeSlots.filter(s => ids.has(s.id)).sort((a, b) => normalizeMin(toMin(a.startTime)) - normalizeMin(toMin(b.startTime)));
    for (let i = 1; i < selected.length; i++) {
      if (normalizeMin(toMin(selected[i].startTime)) !== normalizeMin(toMin(selected[i - 1].endTime))) return false;
    }
    return true;
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.status !== 'free') return;
    const newSet = new Set(selectedSlotIds);
    if (newSet.has(slot.id)) {
      newSet.delete(slot.id);
    } else {
      newSet.add(slot.id);
    }
    // Only allow consecutive selections
    if (areConsecutive(newSet)) {
      setSelectedSlotIds(newSet);
      // Update start/end times from selection
      if (newSet.size > 0) {
        const selected = freeSlots.filter(s => newSet.has(s.id)).sort((a, b) => normalizeMin(toMin(a.startTime)) - normalizeMin(toMin(b.startTime)));
        setStartTime(selected[0].startTime);
        setEndTime(selected[selected.length - 1].endTime);
      } else {
        setStartTime('');
        setEndTime('');
      }
    }
  };

  const handleOpenDialog = () => {
    setGuests(1);
    setComment('');
    if (selectedSlotIds.size === 0) {
      setStartTime('');
      setEndTime('');
    }
    setDialogOpen(true);
  };

  const handleBook = () => {
    if (!startTime || !endTime || guests < 1 || guests > maxGuests) return;
    if (requireGuestInfo) {
      if (!guestName.trim()) return;
      const digits = guestPhone.replace(/\D/g, '');
      if (digits.length < 11) return;
    }
    const slot = freeSlots.find(s => s.startTime <= startTime && s.endTime > startTime) || freeSlots[0];
    if (!slot) return;
    // Pass phone when: unauthenticated (requireGuestInfo) OR authenticated without profile phone
    const phoneToSend = showPhoneInput ? (guestPhone.trim() || undefined) : undefined;
    onBook(
      { ...slot, startTime },
      guests,
      endTime,
      comment.trim() || undefined,
      requireGuestInfo ? guestName.trim() : undefined,
      phoneToSend,
    );
    setSuccessInfo({ date: `${dateLabel}, ${dayName}`, start: startTime, end: endTime, guests });
    setDialogOpen(false);
    setSuccessOpen(true);
    setSelectedSlotIds(new Set());
    setGuestName('');
    setGuestPhone('+7');
    setComment('');
  };

  const durationLabel = startTime && endTime
    ? (() => {
        const s = normalizeMin(toMin(startTime));
        let e = normalizeMin(toMin(endTime));
        if (e <= s) e += 1440; // конец за полночь / полный день
        return `${((e - s) / 60).toFixed(1).replace('.0', '')} ч.`;
      })()
    : '';

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between rounded-lg bg-accent p-3">
        <Button variant="ghost" size="icon" disabled={currentIdx <= 0} onClick={() => setSelectedDate(dates[currentIdx - 1])}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <div className="font-semibold text-lg">{dateLabel}</div>
          <div className="text-sm text-muted-foreground">{dayName}</div>
        </div>
        <Button variant="ghost" size="icon" disabled={currentIdx >= dates.length - 1} onClick={() => setSelectedDate(dates[currentIdx + 1])}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Date chips */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map(d => {
          const dt = new Date(d + 'T00:00:00');
          const freeCount = slots.filter(s => s.date === d && s.status === 'free').length;
          return (
            <button
              key={d}
              onClick={() => { setSelectedDate(d); setSelectedSlotIds(new Set()); setStartTime(''); setEndTime(''); }}
              className={`flex flex-col items-center rounded-lg px-3 py-2 text-sm transition-colors shrink-0 ${
                d === selectedDate ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent'
              }`}
            >
              <span className="font-medium">{dt.getDate()}</span>
              <span className="text-xs opacity-80">{DAYS[dt.getDay()].slice(0, 2)}</span>
              {freeCount > 0 && <span className="mt-0.5 text-[10px] opacity-70">{freeCount} своб.</span>}
            </button>
          );
        })}
      </div>

      {/* Slots overview */}
      <div className="space-y-2">
        {daySlots.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Нет доступных слотов на эту дату</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {daySlots.map(slot => {
                const isFree = slot.status === 'free';
                const isSelected = selectedSlotIds.has(slot.id);
                return (
                  <button
                    key={slot.id}
                    disabled={!isFree}
                    onClick={() => handleSlotClick(slot)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/30'
                        : isFree
                          ? 'border-primary/30 bg-primary/5 text-foreground hover:bg-primary/15 cursor-pointer'
                          : 'border-muted bg-muted/50 text-muted-foreground line-through opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {slot.startTime}–{slot.endTime}
                  </button>
                );
              })}
            </div>

            {selectedSlotIds.size > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-medium text-primary">
                  Выбрано: {startTime} – {endTime} ({((normalizeMin(toMin(endTime)) - normalizeMin(toMin(startTime))) / 60).toFixed(1).replace('.0', '')} ч.)
                </p>
              </div>
            )}

            {freeSlots.length > 0 && (
              <div className="pt-2">
                <Button onClick={handleOpenDialog} className="w-full sm:w-auto" disabled={selectedSlotIds.size === 0}>
                  <Clock className="h-4 w-4 mr-2" />
                  {selectedSlotIds.size > 0 ? 'Забронировать выбранное время' : 'Выберите время выше'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Booking dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Бронирование — {dateLabel}, {dayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Время уже выбрано кликами по слотам — показываем сводку без лишних дропдаунов (правка #11) */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Выбранное время</p>
              <p className="text-base font-semibold text-primary">
                {startTime} – {endTime}
                {startTime && endTime ? (() => {
                  const s = normalizeMin(toMin(startTime));
                  let e = normalizeMin(toMin(endTime));
                  if (e <= s) e += 1440;
                  return ` · ${((e - s) / 60).toFixed(1).replace('.0', '')} ч.`;
                })() : ''}
              </p>
              {/* Расчёт стоимости с учётом длительности и скидки (правка #5) */}
              {startTime && endTime && (pricePerHour || flatPrice) && (() => {
                const s = normalizeMin(toMin(startTime));
                let e = normalizeMin(toMin(endTime));
                if (e <= s) e += 1440;
                const hours = (e - s) / 60;
                const base = pricePerHour ? Math.round(pricePerHour * hours) : (flatPrice ?? 0);
                const final = discountPercent > 0 ? Math.round(base * (1 - discountPercent / 100)) : base;
                return (
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">Стоимость: </span>
                    {discountPercent > 0 ? (
                      <>
                        <span className="line-through text-muted-foreground">{base.toLocaleString()} ₸</span>{' '}
                        <span className="font-semibold text-primary">{final.toLocaleString()} ₸</span>{' '}
                        <span className="text-green-600">(−{discountPercent}%)</span>
                      </>
                    ) : (
                      <span className="font-semibold text-primary">{final.toLocaleString()} ₸</span>
                    )}
                  </p>
                );
              })()}
              {/* Депозит за бронь: платится заведению, остаток — на месте (правка #51) */}
              {bookingDeposit != null && bookingDeposit > 0 && (() => {
                let total: number | null = null;
                if (startTime && endTime && (pricePerHour || flatPrice)) {
                  const s = normalizeMin(toMin(startTime));
                  let e = normalizeMin(toMin(endTime));
                  if (e <= s) e += 1440;
                  const hours = (e - s) / 60;
                  const base = pricePerHour ? Math.round(pricePerHour * hours) : (flatPrice ?? 0);
                  total = discountPercent > 0 ? Math.round(base * (1 - discountPercent / 100)) : base;
                }
                const remainder = total != null ? Math.max(0, total - bookingDeposit) : null;
                return (
                  <div className="mt-2 rounded-md border border-amber-300/50 bg-amber-50 px-2.5 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                      Сумма брони: {bookingDeposit.toLocaleString()} ₸
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-300/80">
                      Заведение выставит счёт на эту сумму для брони места.
                      {remainder != null && remainder > 0 && (
                        <> Остаток {remainder.toLocaleString()} ₸ — на месте после посещения.</>
                      )}
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="guests">Количество человек (макс. {maxGuests})</Label>
              <Input
                id="guests"
                type="number"
                min={1}
                max={maxGuests}
                value={guests}
                onChange={e => setGuests(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий (необязательно)</Label>
              <Textarea
                id="comment"
                placeholder="Пожелания, особые условия..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                maxLength={500}
                className="resize-none"
                rows={3}
              />
            </div>

            {requireGuestInfo && (
              <div className="space-y-3 rounded-lg border bg-accent/40 p-3">
                <p className="text-sm font-medium">Контактные данные</p>
                <div className="space-y-2">
                  <Label htmlFor="guestName">Ваше имя</Label>
                  <Input
                    id="guestName"
                    placeholder="Имя"
                    value={guestName}
                    onChange={e => {
                      const v = e.target.value.replace(/[^A-Za-zА-Яа-яЁё\s-]/g, '');
                      setGuestName(v);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestPhone">Телефон</Label>
                  <PhoneInput
                    id="guestPhone"
                    value={guestPhone}
                    onChange={setGuestPhone}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Регистрация не требуется — заведение свяжется с вами для подтверждения.
                </p>
              </div>
            )}

            {!requireGuestInfo && !userPhone && (
              <div className="space-y-2">
                <Label htmlFor="guestPhone">
                  Телефон для связи
                  <span className="ml-1 text-xs text-muted-foreground">(необязательно — сохранится в профиле)</span>
                </Label>
                <PhoneInput
                  id="guestPhone"
                  value={guestPhone === '+7' ? '' : guestPhone}
                  onChange={setGuestPhone}
                />
              </div>
            )}

            {startTime && endTime && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-medium text-primary">
                  Итого: {startTime} – {endTime} ({durationLabel})
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              onClick={handleBook}
              disabled={
                !startTime ||
                !endTime ||
                guests < 1 ||
                guests > maxGuests ||
                (requireGuestInfo && (!guestName.trim() || !guestPhone.trim()))
              }
            >
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success confirmation */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Заявка отправлена ✅</DialogTitle>
          </DialogHeader>
          {successInfo && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Ваша заявка принята и ожидает подтверждения от заведения.
              </p>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
                <p><span className="font-medium">Дата:</span> {successInfo.date}</p>
                <p><span className="font-medium">Время:</span> {successInfo.start} – {successInfo.end}</p>
                <p><span className="font-medium">Гостей:</span> {successInfo.guests}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Заведение свяжется с вами для подтверждения.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSuccessOpen(false)}>Понятно</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingCalendar;

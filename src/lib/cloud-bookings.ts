import { supabase } from '@/integrations/supabase/client';
import { Booking, BookingStatus } from './types';

const db = supabase as any;

type CloudBookingRow = {
  external_id: string | null;
  slot_id: string;
  cabin_id: string;
  bathhouse_id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  guests: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  comment: string | null;
  created_at: string;
};

const toBooking = (row: CloudBookingRow): Booking => ({
  id: row.external_id || row.slot_id,
  slotId: row.slot_id,
  cabinId: row.cabin_id,
  bathhouseId: row.bathhouse_id,
  clientId: row.client_id,
  clientName: row.client_name,
  clientPhone: row.client_phone || '',
  guests: row.guests,
  date: row.booking_date,
  startTime: row.start_time,
  endTime: row.end_time,
  status: row.status,
  comment: row.comment || undefined,
  createdAt: row.created_at,
});

export const saveCloudBooking = async (booking: Booking) => {
  const { error } = await db.from('bookings').insert({
    external_id: booking.id,
    slot_id: booking.slotId,
    cabin_id: booking.cabinId,
    bathhouse_id: booking.bathhouseId,
    client_id: booking.clientId,
    client_name: booking.clientName,
    client_phone: booking.clientPhone,
    guests: booking.guests,
    booking_date: booking.date,
    start_time: booking.startTime,
    end_time: booking.endTime,
    status: booking.status,
    comment: booking.comment || null,
    created_at: booking.createdAt,
  });

  if (error) throw error;
};

export const fetchAdminCloudBookings = async (admin: { email: string; password: string }): Promise<Booking[]> => {
  const { data, error } = await supabase.functions.invoke('reservehub-bookings', {
    body: { admin },
  });

  if (error) throw error;
  return ((data?.bookings || []) as CloudBookingRow[]).map(toBooking);
};

export const updateCloudBookingStatus = async (
  admin: { email: string; password: string },
  bookingId: string,
  status: BookingStatus,
) => {
  const { error } = await supabase.functions.invoke('reservehub-bookings', {
    body: { admin, action: 'updateStatus', bookingId, status },
  });

  if (error) throw error;
};

export const fetchClientCloudBookings = async (clientId: string): Promise<Booking[]> => {
  const { data, error } = await supabase.functions.invoke('reservehub-bookings', {
    body: { action: 'listByClient', clientId },
  });
  if (error) throw error;
  return ((data?.bookings || []) as CloudBookingRow[]).map(toBooking);
};
DROP POLICY IF EXISTS "Anyone can create booking requests" ON public.bookings;

CREATE POLICY "Visitors can create valid pending booking requests"
ON public.bookings
FOR INSERT
WITH CHECK (
  status = 'pending'
  AND guests BETWEEN 1 AND 100
  AND length(trim(slot_id)) > 0
  AND length(trim(cabin_id)) > 0
  AND length(trim(bathhouse_id)) > 0
  AND length(trim(client_id)) > 0
  AND length(trim(client_name)) > 0
  AND length(trim(client_phone)) > 0
  AND length(trim(start_time)) > 0
  AND length(trim(end_time)) > 0
);
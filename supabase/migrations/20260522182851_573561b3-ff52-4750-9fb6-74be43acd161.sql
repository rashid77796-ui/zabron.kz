CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  slot_id text NOT NULL,
  cabin_id text NOT NULL,
  bathhouse_id text NOT NULL,
  client_id text NOT NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL DEFAULT '',
  guests integer NOT NULL DEFAULT 1,
  booking_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_created_at ON public.bookings (created_at DESC);
CREATE INDEX idx_bookings_bathhouse_id ON public.bookings (bathhouse_id);
CREATE INDEX idx_bookings_client_id ON public.bookings (client_id);
CREATE INDEX idx_bookings_status ON public.bookings (status);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create booking requests"
ON public.bookings
FOR INSERT
WITH CHECK (true);

CREATE POLICY "No direct browser reading of bookings"
ON public.bookings
FOR SELECT
USING (false);

CREATE POLICY "No direct browser updating of bookings"
ON public.bookings
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct browser deleting of bookings"
ON public.bookings
FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.update_bookings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_bookings_updated_at();
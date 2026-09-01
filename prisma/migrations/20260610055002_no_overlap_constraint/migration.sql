-- Install btree_gist for range exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Immutable helper: check if booking status is CONFIRMED
CREATE OR REPLACE FUNCTION booking_status_is_confirmed(s "BookingStatus") RETURNS boolean
  LANGUAGE sql IMMUTABLE STRICT
  AS 'SELECT s = ''CONFIRMED''::"BookingStatus"';

-- Prevent confirmed bookings from overlapping on the same resource.
-- Note: columns are timestamp (no timezone), so tsrange is used (not tstzrange).
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tsrange("startAt", "endAt") WITH &&
  )
  WHERE (booking_status_is_confirmed(status));

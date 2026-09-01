const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSchVANZyTa-LqAf8-B9nCXkcJTtAZ8eORCHWD9If3iWzE7_pQ/formResponse';

interface BookingFormData {
  name: string;
  phone: string;
  bathhouse: string;
  date: string;
  time: string;
  guests: number;
}

export const submitBookingToGoogleForm = async (data: BookingFormData) => {
  // Parse date string "YYYY-MM-DD" into year/month/day for Google Forms date field
  const [year, month, day] = data.date.split('-');

  const params = new URLSearchParams({
    'entry.1093871177': data.name,
    'entry.1295172156': data.phone,
    'entry.1986281497': data.bathhouse,
    'entry.1357395071_year': year,
    'entry.1357395071_month': month,
    'entry.1357395071_day': day,
    'entry.1839187871': data.time,
    'entry.1845736454': String(data.guests),
  });

  try {
    await fetch(`${FORM_URL}?${params.toString()}`, {
      method: 'GET',
      mode: 'no-cors',
    });
    console.log('[GoogleForm] Booking submitted successfully');
  } catch (err) {
    console.error('[GoogleForm] Failed to submit:', err);
  }
};

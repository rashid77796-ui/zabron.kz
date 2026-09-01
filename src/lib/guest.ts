const KEY = 'banya_guest_id';

export const getGuestId = (): string => {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `guest-${crypto.randomUUID()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
};

export const hasGuestBookings = (): boolean => !!localStorage.getItem(KEY);
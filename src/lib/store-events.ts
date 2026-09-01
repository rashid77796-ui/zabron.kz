export const STORE_UPDATED_EVENT = 'banya-store-updated';

export const subscribeToStoreUpdates = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleCustomUpdate = () => callback();
  const handleStorageUpdate = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith('banya_')) callback();
  };

  window.addEventListener(STORE_UPDATED_EVENT, handleCustomUpdate);
  window.addEventListener('storage', handleStorageUpdate);

  return () => {
    window.removeEventListener(STORE_UPDATED_EVENT, handleCustomUpdate);
    window.removeEventListener('storage', handleStorageUpdate);
  };
};
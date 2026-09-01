export const isVideo = (src: string) => {
  if (src.startsWith('data:video/')) return true;
  const ext = src.split('?')[0].split('.').pop()?.toLowerCase();
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '');
};

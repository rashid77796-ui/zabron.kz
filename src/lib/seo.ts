// Дефолтное превью для мессенджеров и соцсетей: WhatsApp, Telegram, Facebook,
// LinkedIn, iMessage читают Open Graph, X — свои twitter:*. Размеры проставлены
// явно, чтобы краулеру не пришлось качать файл целиком ради пропорций.
//
// Относительный путь Next разворачивает в абсолютный сам — через metadataBase
// в src/app/layout.tsx. Без него краулеры получили бы относительный URL.
export const OG_IMAGE = {
  url: '/og.png',
  width: 3600,
  height: 1890,
  alt: 'Zabron — онлайн-бронирование мест отдыха в Казахстане',
}

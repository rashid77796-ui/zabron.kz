'use client'

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bathhouse } from '@/lib/types';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ASTANA_CENTER: [number, number] = [51.1284, 71.4306];
const ASTANA_BOUNDS: L.LatLngBoundsExpression = [
  [50.85, 71.20], // юго-запад
  [51.35, 71.85], // северо-восток
];

const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Props {
  bathhouses: Bathhouse[];
  selectedId?: string | null;
  onMarkerClick?: (id: string) => void;
}

const BathhouseMap = ({ bathhouses, selectedId, onMarkerClick }: Props) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const activatedRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const activateMap = () => {
    if (activatedRef.current) return;
    activatedRef.current = true;
    const map = mapInstance.current;
    if (map) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    }
    if (overlayRef.current) {
      overlayRef.current.style.display = 'none';
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstance.current) {
      const map = L.map(mapRef.current, {
        maxBounds: ASTANA_BOUNDS,
        maxBoundsViscosity: 1.0,
        minZoom: 10,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
      }).setView(ASTANA_CENTER, 12);
      mapInstance.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }).addTo(map);

      // Show user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            const userIcon = new L.DivIcon({
              html: '<div style="width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 6px rgba(59,130,246,0.5);"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
              className: '',
            });
            L.marker([latitude, longitude], { icon: userIcon, interactive: false })
              .addTo(map)
              .bindPopup('Вы здесь');
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    }

    const map = mapInstance.current;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    const valid = bathhouses.filter(b => b.lat && b.lng);
    valid.forEach(b => {
      const isSelected = b.id === selectedId;
      const marker = L.marker([b.lat!, b.lng!], isSelected ? { icon: selectedIcon } : {})
        .addTo(map)
        .bindPopup(
          `<strong>${b.name}</strong><br/><span style="color:#888;font-size:12px">${b.address}</span><br/><a href="/venues/${b.id}" style="font-size:12px">Подробнее →</a>`
        );
      if (isSelected) marker.openPopup();
      marker.on('click', () => { activateMap(); onMarkerClick?.(b.id); });
      markersRef.current[b.id] = marker;
    });

    if (valid.length > 1 && !selectedId) {
      const bounds = L.latLngBounds(valid.map(b => [b.lat!, b.lng!] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (selectedId) {
      const sel = valid.find(b => b.id === selectedId);
      if (sel) map.setView([sel.lat!, sel.lng!], 14, { animate: true });
    }

    return () => {};
  }, [bathhouses, selectedId, onMarkerClick]);

  useEffect(() => {
    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
      activatedRef.current = false;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border shadow-sm relative isolate z-0" style={{ height: 400 }}>
      <div ref={mapRef} className="h-full w-full" />
      {!activatedRef.current && (
        <div
          ref={overlayRef}
          onClick={activateMap}
          className="absolute inset-0 z-[1000] flex items-center justify-center cursor-pointer bg-black/10 transition-opacity"
        >
          <span className="rounded-lg bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-md backdrop-blur-sm">
            Нажмите, чтобы взаимодействовать с картой
          </span>
        </div>
      )}
    </div>
  );
};

export default BathhouseMap;

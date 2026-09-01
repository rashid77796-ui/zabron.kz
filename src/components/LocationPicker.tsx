'use client'

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ASTANA_CENTER: [number, number] = [51.1284, 71.4306];

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

const LocationPicker = ({ lat, lng, onChange }: LocationPickerProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const updateMarker = useCallback((map: L.Map, latlng: L.LatLng) => {
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      markerRef.current = L.marker(latlng, { draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng();
        onChangeRef.current(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
      });
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const center: [number, number] = (lat && lng) ? [lat, lng] : ASTANA_CENTER;
    const map = L.map(mapRef.current).setView(center, 13);
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    updateMarker(map, L.latLng(center[0], center[1]));

    map.on('click', (e: L.LeafletMouseEvent) => {
      updateMarker(map, e.latlng);
      onChangeRef.current(parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)));
    });

    return () => {
      map.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync marker if lat/lng changed externally
  useEffect(() => {
    if (mapInstance.current && markerRef.current && lat && lng) {
      const pos = markerRef.current.getLatLng();
      if (Math.abs(pos.lat - lat) > 0.0001 || Math.abs(pos.lng - lng) > 0.0001) {
        markerRef.current.setLatLng([lat, lng]);
        mapInstance.current.panTo([lat, lng]);
      }
    }
  }, [lat, lng]);

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Кликните на карту или перетащите маркер для выбора местоположения</p>
      <div className="overflow-hidden rounded-lg border" style={{ height: 250 }}>
        <div ref={mapRef} className="h-full w-full" />
      </div>
    </div>
  );
};

export default LocationPicker;

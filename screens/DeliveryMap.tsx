import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet icons in React
const iconUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png';

const customIcon = new L.Icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface DeliveryMapProps {
  deliveryLocation?: { latitude: number; longitude: number };
  customerLocation?: { latitude: number; longitude: number };
  showRoute?: boolean;
  isDelivering?: boolean;
  onLocationUpdate?: () => void;
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({ deliveryLocation, customerLocation }) => {
  const center = deliveryLocation 
    ? [deliveryLocation.latitude, deliveryLocation.longitude] as [number, number]
    : [-23.55052, -46.633308] as [number, number];

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {deliveryLocation && (
        <Marker position={[deliveryLocation.latitude, deliveryLocation.longitude]} icon={customIcon}>
          <Popup>Entrega</Popup>
        </Marker>
      )}
      {customerLocation && (
        <Marker position={[customerLocation.latitude, customerLocation.longitude]} icon={customIcon}>
          <Popup>Você</Popup>
        </Marker>
      )}
    </MapContainer>
  );
};
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Colored SVG marker helper
const svgIcon = (color, glyph) => L.divIcon({
  className: "",
  html: `
    <div style="position:relative; width:36px; height:44px;">
      <div style="position:absolute; inset:0; background:${color}; border-radius:50% 50% 50% 0; transform:rotate(-45deg); box-shadow:0 0 12px ${color}88;"></div>
      <div style="position:absolute; top:8px; left:8px; width:20px; height:20px; background:#05050A; border-radius:50%; color:${color}; display:flex; align-items:center; justify-content:center; font-family:'Outfit',sans-serif; font-weight:900; font-size:11px;">${glyph}</div>
    </div>`,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  popupAnchor: [0, -40],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function TechMap({ techLat, techLng, destLat, destLng, techName }) {
  if (!techLat || !destLat) return null;
  const tech = [techLat, techLng];
  const dest = [destLat, destLng];
  const center = [(techLat + destLat) / 2, (techLng + destLng) / 2];

  return (
    <div className="rounded-3xl overflow-hidden border border-white/10 h-72" data-testid="tech-map">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%", background: "#05050A" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Marker position={tech} icon={svgIcon("#39FF14", "T")}>
          <Popup>{techName || "Technician"}</Popup>
        </Marker>
        <Marker position={dest} icon={svgIcon("#FF007F", "U")}>
          <Popup>Your address</Popup>
        </Marker>
        <Polyline positions={[tech, dest]} pathOptions={{ color: "#00E5FF", weight: 3, dashArray: "8 6" }} />
        <FitBounds points={[tech, dest]} />
      </MapContainer>
    </div>
  );
}

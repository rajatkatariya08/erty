import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Loader2 } from "lucide-react";

const pinIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative; width:36px; height:44px;">
      <div style="position:absolute; inset:0; background:#FF007F; border-radius:50% 50% 50% 0; transform:rotate(-45deg); box-shadow:0 0 16px #FF007F99;"></div>
      <div style="position:absolute; top:8px; left:8px; width:20px; height:20px; background:#05050A; border-radius:50%;"></div>
    </div>`,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

/**
 * AddressPickerMap
 * - Interactive Leaflet map. Click or drag pin to select location.
 * - Calls Nominatim reverse-geocode; passes formatted address back via onAddressChange.
 * - Optional bounds enforce Gurugram-only picking.
 */
export default function AddressPickerMap({
  center,               // {lat, lng}
  bounds,               // {lat_min, lat_max, lng_min, lng_max} optional
  coords,               // controlled {lat, lng} | null
  onCoordsChange,       // (lat, lng) => void
  onAddressChange,      // (addressStr) => void
  onOutOfArea,          // () => void  (optional callback when user picks outside bounds)
}) {
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);

  const inArea = (lat, lng) => {
    if (!bounds) return true;
    return (
      lat >= bounds.lat_min && lat <= bounds.lat_max &&
      lng >= bounds.lng_min && lng <= bounds.lng_max
    );
  };

  const reverseGeocode = async (lat, lng) => {
    setBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("geocode failed");
      const data = await res.json();
      const addr = data.address || {};
      // Prefer street-level composition
      const parts = [
        [addr.house_number, addr.road].filter(Boolean).join(" "),
        addr.neighbourhood || addr.suburb,
        addr.city || addr.town || addr.village,
        addr.state,
        addr.postcode,
      ].filter(Boolean);
      const composed = parts.length ? parts.join(", ") : (data.display_name || "");
      onAddressChange?.(composed);
    } catch {
      onAddressChange?.("");
    } finally {
      setBusy(false);
    }
  };

  const handlePick = (lat, lng) => {
    if (!inArea(lat, lng)) {
      onOutOfArea?.();
      return;
    }
    onCoordsChange?.(lat, lng);
    // Debounce Nominatim calls to respect their 1 req/sec rate limit.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => reverseGeocode(lat, lng), 500);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => handlePick(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const c = coords || center;

  return (
    <div className="space-y-2">
      <div className="relative rounded-3xl overflow-hidden border border-white/10 h-72" data-testid="address-picker-map">
        <MapContainer
          center={[c.lat, c.lng]}
          zoom={13}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "#05050A" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <ClickHandler onPick={handlePick} />
          {coords && (
            <Marker
              position={[coords.lat, coords.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const p = e.target.getLatLng();
                  handlePick(p.lat, p.lng);
                },
              }}
            />
          )}
          <Recenter lat={c.lat} lng={c.lng} />
        </MapContainer>
        <button
          onClick={useMyLocation}
          data-testid="use-my-loc-btn"
          className="absolute top-3 right-3 z-[400] rounded-full glass px-3 py-2 text-xs font-semibold text-white inline-flex items-center gap-1.5"
        >
          <LocateFixed className="h-3.5 w-3.5 text-[#00E5FF]" /> Use my location
        </button>
        {busy && (
          <div className="absolute bottom-3 left-3 z-[400] rounded-full glass px-3 py-1.5 text-xs text-white/80 inline-flex items-center gap-1.5" data-testid="geocode-busy">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#39FF14]" /> Finding address…
          </div>
        )}
      </div>
      <div className="text-[11px] text-white/40">
        Tap or drag the pin to your exact door. Service area: <span className="text-white/80">Gurugram, Haryana</span>.
      </div>
    </div>
  );
}

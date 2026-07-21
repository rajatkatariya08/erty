import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, Clock, StickyNote, Phone } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import AddressPickerMap from "../components/AddressPickerMap";

const SLOTS = ["09:00 - 11:00", "11:00 - 13:00", "14:00 - 16:00", "16:00 - 18:00", "18:00 - 20:00"];

function nextDates(count = 6) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

export default function Booking() {
  const { serviceId } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const preTier = sp.get("tier");
  const diagId = sp.get("diagnosis_id");

  const [service, setService] = useState(null);
  const [tier, setTier] = useState(preTier || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState(SLOTS[0]);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState(null);
  const [area, setArea] = useState(null);

  useEffect(() => {
    api.get(`/services/${serviceId}`).then(r => {
      setService(r.data);
      if (!tier) setTier(r.data.tiers[0].name);
    });
    api.get("/service-area").then(r => setArea(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const submit = async () => {
    if (!/^\\d{10}$/.test(phone.replace(/\\D/g, ""))) { toast.error("Please enter a valid 10-digit contact number"); return; }
    if (!coords) { toast.error("Please drop a pin on the map for your location"); return; }
    if (!address.trim()) { toast.error("Address is required"); return; }
    setSubmitting(true);
    try {
      const payload = {
        service_id: serviceId,
        tier_name: tier,
        address,
        scheduled_date: date,
        scheduled_slot: slot,
        notes,
        customer_phone: phone.replace(/\\D/g, ""),
        diagnosis_id: diagId || undefined,
        dest_lat: coords.lat,
        dest_lng: coords.lng,
      };
      const { data } = await api.post("/bookings", payload);
      toast.success("Booking confirmed!");
      navigate(`/bookings/${data.booking_id}`, { replace: true });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to book");
    } finally {
      setSubmitting(false);
    }
  };

  if (!service) return <div className="text-white/60">Loading…</div>;
  const selectedTier = service.tiers.find(t => t.name === tier) || service.tiers[0];

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white" data-testid="back-btn">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#39FF14]">Book Service</div>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-black tracking-tight">{service.name}</h1>
        {area && (
          <div className="mt-2 text-xs text-white/50" data-testid="service-area-label">
            Serving <span className="text-white/80 font-semibold">{area.city}, {area.region}</span>
          </div>
        )}
      </div>

      <div className="card-fix p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Plan</div>
            <div className="font-display text-lg font-bold mt-1">{selectedTier.name}</div>
          </div>
          <div className="font-display text-3xl font-black neon-text-lime">₹{selectedTier.price}</div>
        </div>
      </div>

      {/* Date */}
      <div>
        <div className="flex items-center gap-2 text-sm text-white/70 mb-3">
          <Calendar className="h-4 w-4 text-[#00E5FF]" /> Select date
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          {nextDates(7).map(d => {
            const iso = d.toISOString().slice(0, 10);
            const active = date === iso;
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                data-testid={`date-${iso}`}
                className={`shrink-0 rounded-2xl px-4 py-3 text-center transition-colors ${
                  active ? "bg-[#00E5FF] text-[#05050A]" : "glass text-white/80"
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                <div className="font-display text-xl font-bold">{d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slot */}
      <div>
        <div className="flex items-center gap-2 text-sm text-white/70 mb-3">
          <Clock className="h-4 w-4 text-[#FF007F]" /> Time slot
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SLOTS.map(s => (
            <button
              key={s}
              onClick={() => setSlot(s)}
              data-testid={`slot-${s.replace(/[^0-9]/g, "-")}`}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                slot === s ? "bg-[#FF007F] text-white shadow-[0_0_20px_rgba(255,0,127,0.4)]" : "glass text-white/70"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Address picker */}
      <div>
        <div className="flex items-center gap-2 text-sm text-white/70 mb-3">
          <MapPin className="h-4 w-4 text-[#FFEA00]" /> Pin your exact location
        </div>
        {area && (
          <AddressPickerMap
            center={area.center}
            bounds={area.bounds}
            coords={coords}
            onCoordsChange={(lat, lng) => setCoords({ lat, lng })}
            onAddressChange={(a) => setAddress(a)}
            onOutOfArea={() => toast.error("We serve only Gurugram, Haryana at the moment")}
          />
        )}
        <textarea
          data-testid="address-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          placeholder="Auto-filled from map — edit to add flat/floor/landmarks"
          className="mt-3 w-full rounded-2xl bg-[#121217] border border-white/10 p-4 text-sm text-white placeholder:text-white/30 focus:border-[#00E5FF] focus:outline-none"
        />
        {coords && (
          <div className="mt-1.5 text-[11px] text-white/40" data-testid="coords-display">
            GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
          <Phone className="h-4 w-4 text-[#39FF14]" /> Contact number <span className="text-[#FF007F]">*</span>
        </div>
        <input
          data-testid="contact-phone-input"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\\d+() -]/g, ""))}
          placeholder="10-digit number for booking updates"
          className="w-full rounded-2xl bg-[#121217] border border-white/10 p-4 text-sm text-white placeholder:text-white/30 focus:border-[#00E5FF] focus:outline-none"
          required
        />
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
          <StickyNote className="h-4 w-4 text-white/60" /> Notes (optional)
        </div>
        <textarea
          data-testid="notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything the technician should know"
          className="w-full rounded-2xl bg-[#121217] border border-white/10 p-4 text-sm text-white placeholder:text-white/30 focus:border-[#00E5FF] focus:outline-none"
        />
      </div>

      <div className="glass rounded-2xl p-4 text-xs text-white/60">
        Payment: <span className="text-white/90 font-semibold">Pay on service</span> — no upfront charge.
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        data-testid="confirm-booking-btn"
        className="btn-neon-lime rounded-full px-8 py-4 font-semibold text-base w-full disabled:opacity-60"
      >
        {submitting ? "Booking…" : `Confirm booking · ₹${selectedTier.price}`}
      </button>
    </div>
  );
}

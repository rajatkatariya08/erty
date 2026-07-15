import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MapPin, Calendar, Star, Navigation } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import TechMap from "../components/TechMap";

const STAGES = [
  { key: "assigned", label: "Assigned" },
  { key: "on_the_way", label: "On the way" },
  { key: "arrived", label: "Arrived" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];

export default function BookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [b, setB] = useState(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [distance, setDistance] = useState(null);
  const pollRef = useRef(null);

  const load = () => api.get(`/bookings/${bookingId}`).then(r => setB(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookingId]);

  // Poll for tech location updates while tech is en route
  useEffect(() => {
    if (!b) return;
    if (!["assigned", "on_the_way"].includes(b.status)) return;
    pollRef.current = setInterval(() => { load(); }, 8000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line
  }, [b?.status]);

  if (!b) return <div className="text-white/60">Loading…</div>;

  const currentIdx = STAGES.findIndex(s => s.key === b.status);
  const hasGps = b.tech_lat != null && b.dest_lat != null;
  const trackable = ["assigned", "on_the_way"].includes(b.status);

  const advance = async () => {
    const next = STAGES[currentIdx + 1];
    if (!next) return;
    await api.patch(`/bookings/${bookingId}/status`, { status: next.key });
    load();
    toast.success(`Status: ${next.label}`);
  };

  const simulateMove = async () => {
    try {
      const { data } = await api.post(`/bookings/${bookingId}/simulate-tech`);
      setDistance(data.distance_m);
      load();
      toast.success(`Tech moved · ${(data.distance_m / 1000).toFixed(2)} km left`);
    } catch {
      toast.error("Move failed");
    }
  };

  const submitReview = async () => {
    if (!rating) { toast.error("Pick a rating"); return; }
    await api.post(`/bookings/${bookingId}/review`, { rating, review });
    toast.success("Thanks for your review!");
    load();
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/bookings")} className="inline-flex items-center gap-2 text-sm text-white/60" data-testid="back-btn">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </button>

      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#00E5FF]">{b.category.replace("_", " ")}</div>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-black tracking-tight">{b.service_name}</h1>
        <div className="mt-2 text-sm text-white/60">Booking ID: <span className="font-mono">{b.booking_id.slice(0, 12)}</span></div>
      </div>

      {/* Technician */}
      {b.tech_name && (
        <div className="card-fix p-5 flex items-center gap-4">
          <img src={b.tech_picture} alt={b.tech_name} className="h-14 w-14 rounded-2xl bg-white/5" />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Technician</div>
            <div className="font-display text-lg font-bold" data-testid="tech-name">{b.tech_name}</div>
          </div>
          <a href={`tel:+919999999999`} className="rounded-full glass px-4 py-2.5 text-sm inline-flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#39FF14]" /> Call
          </a>
        </div>
      )}

      {/* Live GPS Map */}
      {hasGps && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Navigation className="h-4 w-4 text-[#00E5FF]" />
              <span>Live tracking</span>
              {distance != null && (
                <span className="ml-2 text-xs text-white/50" data-testid="distance-label">
                  · {(distance / 1000).toFixed(2)} km away
                </span>
              )}
            </div>
            {trackable && (
              <button
                onClick={simulateMove}
                data-testid="simulate-move-btn"
                className="text-xs rounded-full glass px-3 py-1.5 font-semibold text-[#00E5FF]"
              >
                Simulate move
              </button>
            )}
          </div>
          <TechMap
            techLat={b.tech_lat}
            techLng={b.tech_lng}
            destLat={b.dest_lat}
            destLng={b.dest_lng}
            techName={b.tech_name}
          />
        </div>
      )}

      {/* Status tracker */}
      <div className="card-fix p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50 mb-4">Live status</div>
        <div className="relative pl-6">
          <div className="absolute left-[9px] top-0 bottom-0 w-px bg-white/10" />
          {STAGES.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s.key} className="relative flex items-center gap-3 py-2.5">
                <div className={`absolute -left-6 h-5 w-5 rounded-full ${
                  done ? "bg-[#39FF14]" : active ? "bg-[#39FF14] shadow-[0_0_16px_rgba(57,255,20,0.7)]" : "bg-white/10 border border-white/20"
                }`}>
                  {active && <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-full w-full rounded-full bg-[#39FF14] opacity-60" />}
                </div>
                <div className={`text-sm ${done || active ? "text-white" : "text-white/40"}`}>{s.label}</div>
              </div>
            );
          })}
        </div>
        {currentIdx >= 0 && currentIdx < STAGES.length - 1 && (
          <button
            onClick={advance}
            data-testid="advance-status-btn"
            className="mt-4 rounded-full glass px-4 py-2 text-xs font-semibold text-white/80"
          >
            Simulate: Advance to {STAGES[currentIdx + 1].label}
          </button>
        )}
      </div>

      {/* Details */}
      <div className="card-fix p-6 space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <Calendar className="h-4 w-4 text-[#00E5FF] mt-0.5" />
          <div><div className="text-white/50 text-xs">Scheduled</div><div>{b.scheduled_date} · {b.scheduled_slot}</div></div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-[#FFEA00] mt-0.5" />
          <div><div className="text-white/50 text-xs">Address</div><div>{b.address}</div></div>
        </div>
        {b.notes && (
          <div className="text-white/70">
            <div className="text-white/50 text-xs">Notes</div>
            <div>{b.notes}</div>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-white/50">Total</span>
          <span className="font-display text-2xl font-black neon-text-lime">₹{b.price}</span>
        </div>
        <div className="text-xs text-white/50">Pay on service</div>
      </div>

      {/* Review */}
      {b.status === "completed" && !b.rating && (
        <div className="card-fix p-6">
          <div className="font-display text-lg font-bold">Rate your service</div>
          <div className="mt-3 flex items-center gap-2">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRating(n)} data-testid={`star-${n}`} className="p-1">
                <Star className={`h-7 w-7 ${n <= rating ? "text-[#FFEA00] fill-[#FFEA00]" : "text-white/25"}`} />
              </button>
            ))}
          </div>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={2}
            placeholder="Share how it went (optional)"
            data-testid="review-input"
            className="mt-3 w-full rounded-2xl bg-[#0B0B10] border border-white/10 p-3 text-sm"
          />
          <button onClick={submitReview} data-testid="submit-review-btn" className="mt-3 btn-neon-lime rounded-full px-6 py-3 font-semibold text-sm w-full">
            Submit review
          </button>
        </div>
      )}
      {b.rating && (
        <div className="card-fix p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Your rating</div>
          <div className="mt-2 flex items-center gap-1">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`h-5 w-5 ${n <= b.rating ? "text-[#FFEA00] fill-[#FFEA00]" : "text-white/20"}`} />
            ))}
          </div>
          {b.review && <div className="mt-2 text-sm text-white/70">&ldquo;{b.review}&rdquo;</div>}
        </div>
      )}
    </div>
  );
}

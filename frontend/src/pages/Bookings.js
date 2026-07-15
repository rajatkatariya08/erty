import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardList, ArrowRight } from "lucide-react";
import { api } from "../lib/api";

const statusColor = {
  assigned: "text-[#FFEA00]",
  on_the_way: "text-[#00E5FF]",
  arrived: "text-[#FF007F]",
  in_progress: "text-[#FF007F]",
  completed: "text-[#39FF14]",
  cancelled: "text-white/50",
};
const statusLabel = {
  assigned: "Assigned",
  on_the_way: "On the way",
  arrived: "Arrived",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/bookings").then(r => setBookings(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#FF007F]">Your bookings</div>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-black tracking-tight">Track & manage</h1>
      </div>

      {loading && <div className="text-white/60">Loading…</div>}
      {!loading && bookings.length === 0 && (
        <div className="card-fix p-8 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-white/40" />
          <div className="mt-3 font-semibold">No bookings yet</div>
          <div className="text-sm text-white/50 mt-1">Book a service or run an AI diagnosis to get started.</div>
          <Link to="/" data-testid="explore-btn" className="btn-neon-blue inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-sm mt-5">
            Explore services <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b, i) => (
          <motion.div
            key={b.booking_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/bookings/${b.booking_id}`}
              data-testid={`booking-${b.booking_id}`}
              className="card-fix p-5 flex items-center gap-4 hover:border-white/20 transition-colors"
            >
              {b.tech_picture && (
                <img src={b.tech_picture} alt={b.tech_name} className="h-12 w-12 rounded-2xl bg-white/5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{b.service_name}</div>
                <div className="text-xs text-white/50 mt-0.5">
                  {b.scheduled_date} · {b.scheduled_slot}
                </div>
                <div className={`mt-1 text-xs font-semibold uppercase tracking-widest ${statusColor[b.status] || "text-white"}`}>
                  {statusLabel[b.status] || b.status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/50">Price</div>
                <div className="font-display text-lg font-bold">₹{b.price}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

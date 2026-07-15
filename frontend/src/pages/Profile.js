import { useEffect, useState } from "react";
import { LogOut, ScanLine, ClipboardList } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user, logout } = useAuth();
  const [diagnoses, setDiagnoses] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    api.get("/diagnosis").then(r => setDiagnoses(r.data)).catch(() => {});
    api.get("/bookings").then(r => setBookings(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="card-fix p-6 flex items-center gap-4">
        <div className="blob" style={{ background: "#FF007F", top: -60, right: -40 }} />
        <div className="relative flex items-center gap-4 w-full">
          {user?.picture && <img src={user.picture} className="h-16 w-16 rounded-2xl border border-white/20" alt="me" />}
          <div className="flex-1">
            <div className="font-display text-2xl font-black" data-testid="profile-name">{user?.name}</div>
            <div className="text-sm text-white/60" data-testid="profile-email">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            data-testid="logout-btn"
            className="rounded-full glass px-4 py-2.5 text-sm text-white/80 inline-flex items-center gap-2"
          >
            <LogOut className="h-4 w-4 text-[#FF007F]" /> Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-fix p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Bookings</div>
          <div className="mt-2 font-display text-3xl font-black neon-text-lime">{bookings.length}</div>
        </div>
        <div className="card-fix p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Diagnoses</div>
          <div className="mt-2 font-display text-3xl font-black neon-text-blue">{diagnoses.length}</div>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2 text-white/80 font-display text-lg font-bold">
          <ScanLine className="h-4 w-4 text-[#00E5FF]" /> Past diagnoses
        </div>
        <div className="space-y-3">
          {diagnoses.length === 0 && <div className="text-white/50 text-sm">No diagnoses yet.</div>}
          {diagnoses.slice(0, 6).map(d => (
            <div key={d.diagnosis_id} className="card-fix p-4" data-testid={`diag-${d.diagnosis_id}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">{d.issue_summary}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/50">{d.severity}</div>
              </div>
              <div className="mt-1 text-xs text-white/50">₹{d.estimated_cost_min} – ₹{d.estimated_cost_max} · {d.category.replace("_", " ")}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 text-white/80 font-display text-lg font-bold">
          <ClipboardList className="h-4 w-4 text-[#39FF14]" /> Recent bookings
        </div>
        <div className="space-y-3">
          {bookings.length === 0 && <div className="text-white/50 text-sm">No bookings yet.</div>}
          {bookings.slice(0, 4).map(b => (
            <Link key={b.booking_id} to={`/bookings/${b.booking_id}`} className="card-fix p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{b.service_name}</div>
                <div className="text-xs text-white/50">{b.scheduled_date} · {b.status}</div>
              </div>
              <div className="font-display text-lg font-bold">₹{b.price}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

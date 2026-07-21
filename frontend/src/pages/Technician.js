import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Hammer, MapPin, CheckCircle2, PlayCircle, Flag, Navigation, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import TechMap from "../components/TechMap";

const STAGE_META = {
  assigned:    { label: "Assigned",    color: "text-[#FFEA00]" },
  on_the_way:  { label: "On the way",  color: "text-[#00E5FF]" },
  arrived:     { label: "Arrived",     color: "text-[#FF007F]" },
  in_progress: { label: "In progress", color: "text-[#FF007F]" },
  completed:   { label: "Completed",   color: "text-[#39FF14]" },
  cancelled:   { label: "Cancelled",   color: "text-white/50" },
};

const NEXT_ACTIONS = {
  assigned:    { key: "on_the_way",  label: "Accept · Start route", accept: true },
  on_the_way:  { key: "arrived",     label: "Mark arrived" },
  arrived:     { key: "in_progress", label: "Start job" },
  in_progress: { key: "completed",   label: "Mark completed" },
};

export default function Technician() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tech, setTech] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState("active");
  const [locBusy, setLocBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user?.is_technician) {
      toast.error("Technician access only");
      navigate("/technician/login", { replace: true });
    }
  }, [user, loading, navigate]);

  const load = async () => {
    // Skip protected calls while pending — backend returns 403.
    if (user?.tech_status !== "approved") {
      try {
        const me = await api.get("/tech/me").catch(() => null);
        if (me?.data) setTech(me.data);
      } catch { /* ignore */ }
      return;
    }
    const [me, js] = await Promise.all([
      api.get("/tech/me"),
      api.get("/tech/jobs"),
    ]);
    setTech(me.data);
    setJobs(js.data);
  };
  useEffect(() => { if (user?.is_technician) load(); /* eslint-disable-next-line */ }, [user]);

  if (loading || !user?.is_technician) return <div className="text-white/60">Loading…</div>;

  // ---- Pending / rejected screen ----
  if (user.tech_status !== "approved") {
    const pending = user.tech_status === "pending";
    return (
      <div className="space-y-6" data-testid="tech-pending-screen">
        <div className="card-fix p-8 text-center">
          <div className="blob" style={{ background: pending ? "#FFEA00" : "#FF007F", top: -60, right: -30 }} />
          <div className="relative">
            <div className="text-xs uppercase tracking-[0.25em]" style={{ color: pending ? "#FFEA00" : "#FF007F" }}>
              {pending ? "Awaiting Approval" : "Application Rejected"}
            </div>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl font-black tracking-tight">
              {pending ? "Almost there!" : "Not approved"}
            </h1>
            <p className="mt-3 text-sm text-white/60 max-w-md mx-auto">
              {pending
                ? "Our admin team is reviewing your government ID and details. You'll be able to accept jobs as soon as your account is approved."
                : "Your onboarding was declined. Please contact support for details."}
            </p>
            {tech && (
              <div className="mt-6 inline-flex items-center gap-3 rounded-2xl glass px-4 py-3">
                <img src={tech.picture} alt={tech.name} className="h-10 w-10 rounded-xl" />
                <div className="text-left">
                  <div className="font-semibold text-sm">{tech.name}</div>
                  <div className="text-xs text-white/50">{(tech.specializations || []).join(", ")}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const active = jobs.filter(j => !["completed", "cancelled"].includes(j.status));
  const done = jobs.filter(j => ["completed", "cancelled"].includes(j.status));
  const list = tab === "active" ? active : done;
  const focused = active[0];

  const advance = async (job) => {
    const nx = NEXT_ACTIONS[job.status];
    if (!nx) return;
    try {
      if (nx.accept) {
        await api.post(`/tech/jobs/${job.booking_id}/accept`);
      } else {
        await api.patch(`/tech/jobs/${job.booking_id}/status`, { status: nx.key });
      }
      toast.success(`Job → ${STAGE_META[nx.key]?.label || nx.key}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Update failed");
    }
  };

  const pushLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation unavailable"); return; }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await api.patch("/tech/location", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        toast.success("Live location pushed to customers");
        load();
      } catch (e) {
        toast.error("Location update failed");
      } finally {
        setLocBusy(false);
      }
    }, () => {
      toast.error("Location permission denied");
      setLocBusy(false);
    }, { enableHighAccuracy: true, timeout: 8000 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-fix p-5 flex items-center gap-4" data-testid="tech-header">
        <div className="blob" style={{ background: "#39FF14", top: -60, right: -40 }} />
        <div className="relative flex items-center gap-4 w-full">
          {tech?.picture && <img src={tech.picture} alt={tech.name} className="h-14 w-14 rounded-2xl border border-white/20" />}
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-[0.25em] text-[#39FF14] inline-flex items-center gap-1.5">
              <Hammer className="h-3.5 w-3.5" /> Technician
            </div>
            <div className="mt-1 font-display text-xl font-black" data-testid="tech-header-name">{tech?.name}</div>
            <div className="text-xs text-white/50">★ {tech?.rating} · {tech?.experience_years}y · {tech?.specializations?.join(", ")}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Active" value={active.length} color="text-[#FFEA00]" />
        <StatCard label="Today's Earnings" value={`₹${active.filter(j => j.status !== "cancelled").reduce((s, j) => s + (j.price || 0), 0)}`} color="text-[#39FF14]" />
        <StatCard label="Completed" value={done.filter(j => j.status === "completed").length} color="text-[#00E5FF]" />
        <StatCard label="Total jobs" value={jobs.length} color="text-white" />
      </div>

      {/* Live location push */}
      <div className="card-fix p-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-2xl bg-[#00E5FF]/15 flex items-center justify-center">
          <Navigation className="h-5 w-5 text-[#00E5FF]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Push your live GPS to customers</div>
          <div className="text-xs text-white/50 mt-0.5">Updates every active job's map pin</div>
        </div>
        <button
          onClick={pushLocation}
          disabled={locBusy}
          data-testid="push-location-btn"
          className="btn-neon-blue rounded-full px-4 py-2.5 font-semibold text-xs inline-flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${locBusy ? "animate-spin" : ""}`} /> {locBusy ? "Pushing…" : "Update"}
        </button>
      </div>

      {/* Focused active job with map */}
      {focused && focused.tech_lat != null && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Flag className="h-4 w-4 text-[#FF007F]" /> Current focus
          </div>
          <TechMap
            techLat={focused.tech_lat}
            techLng={focused.tech_lng}
            destLat={focused.dest_lat}
            destLng={focused.dest_lng}
            techName={tech?.name}
          />
        </div>
      )}

      {/* Jobs list */}
      <div>
        <div className="glass rounded-full p-1.5 flex gap-1 mb-4 w-fit" data-testid="tech-job-tabs">
          {[{k:"active",l:"Active"},{k:"history",l:"History"}].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              data-testid={`tech-tab-${t.k}`}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.k ? "bg-[#39FF14] text-[#05050A]" : "text-white/70"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {list.length === 0 && (
            <div className="text-white/50 text-sm">No {tab} jobs.</div>
          )}
          {list.map((j, i) => {
            const meta = STAGE_META[j.status] || STAGE_META.assigned;
            const nx = NEXT_ACTIONS[j.status];
            return (
              <motion.div
                key={j.booking_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-fix p-5"
                data-testid={`tech-job-${j.booking_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-bold truncate">{j.service_name}</div>
                    <div className="text-xs text-white/50 mt-1">{j.scheduled_date} · {j.scheduled_slot}</div>
                    <div className="mt-2 flex items-start gap-2 text-sm text-white/75">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-[#FFEA00] shrink-0" />
                      <span className="truncate">{j.address}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[10px] uppercase tracking-widest ${meta.color}`}>{meta.label}</div>
                    <div className="mt-1 font-display font-bold text-[#39FF14]">₹{j.price}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-[#0B0B10] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-white/40">Customer</div>
                    <div className="mt-1 text-sm font-semibold text-white/90">{j.customer_name || "Customer details pending"}</div>
                    {j.customer_email && <div className="mt-1 truncate text-xs text-white/55">{j.customer_email}</div>}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0B0B10] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-white/40">Service location</div>
                    <div className="mt-1 text-xs leading-5 text-white/75">{j.address || "Address not provided"}</div>
                    {j.dest_lat != null && j.dest_lng != null && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${j.dest_lat},${j.dest_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#00E5FF] hover:text-white"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Open in Maps
                      </a>
                    )}
                  </div>
                </div>
                {j.notes && (
                  <div className="mt-3 rounded-2xl bg-[#0B0B10] border border-white/5 p-3 text-xs text-white/70">
                    <span className="text-white/40">Note: </span>{j.notes}
                  </div>
                )}
                {nx && (
                  <button
                    onClick={() => advance(j)}
                    data-testid={`tech-advance-${j.booking_id}`}
                    className="mt-4 btn-neon-lime rounded-full px-5 py-2.5 font-semibold text-xs inline-flex items-center gap-2"
                  >
                    {j.status === "assigned" ? <PlayCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {nx.label}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="card-fix p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className={`mt-1.5 font-display text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}

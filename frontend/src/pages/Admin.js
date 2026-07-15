import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  ClipboardList,
  ClipboardPlus,
  Hammer,
  MailCheck,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const STATUSES = ["unassigned", "assigned", "on_the_way", "arrived", "in_progress", "completed", "cancelled"];

const SERVICE_CATEGORIES = [
  { value: "home_appliances", label: "Home Appliances", color: "#FF007F" },
  { value: "handyman", label: "Handyman & Odd Jobs", color: "#39FF14" },
  { value: "car_and_bike", label: "Car & Bike Repair", color: "#00E5FF" },
];

const CUSTOM_STATUSES = ["pending_manpower_approval", "approved", "rejected", "fulfilled"];

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [services, setServices] = useState([]);
  const [techs, setTechs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pending, setPending] = useState([]);
  const [customJobs, setCustomJobs] = useState([]);
  const [outbound, setOutbound] = useState([]);
  const [assignFor, setAssignFor] = useState(null);
  const [showSvcForm, setShowSvcForm] = useState(false);
  const [showTechForm, setShowTechForm] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!loading && !user?.is_admin) {
      toast.error("Admin access only");
      navigate("/admin/login", { replace: true });
    }
  }, [user, loading, navigate]);

  const loadAll = useCallback(async () => {
    if (!user?.is_admin) return;
    setBusy(true);
    setLoadError("");
    try {
      const [s, sv, t, b, p, cj, ob] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/services"),
        api.get("/admin/technicians"),
        api.get("/admin/bookings"),
        api.get("/admin/technicians/pending"),
        api.get("/admin/custom-jobs"),
        api.get("/admin/outbound").catch(() => ({ data: [] })),
      ]);
      setStats(s.data);
      setServices(sv.data);
      setTechs(t.data);
      setBookings(b.data);
      setPending(p.data);
      setCustomJobs(cj.data);
      setOutbound(ob.data);
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Could not load admin controls.");
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const tabs = useMemo(() => {
    const pendingCustom = customJobs.filter((item) => item.status === "pending_manpower_approval").length;
    return [
      { id: "overview", label: "Overview", icon: Shield },
      { id: "onboarding", label: `Onboarding${pending.length ? ` ${pending.length}` : ""}`, icon: UserCheck },
      { id: "bookings", label: `Bookings${stats?.bookings_unassigned ? ` ${stats.bookings_unassigned}` : ""}`, icon: ClipboardList },
      { id: "services", label: "Services", icon: Wrench },
      { id: "technicians", label: "Technicians", icon: Users },
      { id: "custom", label: `Custom${pendingCustom ? ` ${pendingCustom}` : ""}`, icon: ClipboardPlus },
      { id: "outbound", label: "Messages", icon: BellRing },
    ];
  }, [customJobs, pending.length, stats]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const haystack = `${booking.service_name || ""} ${booking.address || ""} ${booking.status || ""} ${booking.tech_name || ""}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [bookings, query]);

  const filteredTechs = useMemo(() => {
    return techs.filter((tech) => {
      const haystack = `${tech.name || ""} ${tech.email || ""} ${(tech.specializations || []).join(" ")} ${tech.status || ""}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [techs, query]);

  if (loading || !user?.is_admin) return <div className="text-white/60">Loading...</div>;

  const deleteService = async (id) => {
    if (!window.confirm("Delete this service?")) return;
    await api.delete(`/admin/services/${id}`);
    toast.success("Service deleted");
    loadAll();
  };

  const deleteTech = async (id) => {
    if (!window.confirm("Delete this technician?")) return;
    await api.delete(`/admin/technicians/${id}`);
    toast.success("Technician deleted");
    loadAll();
  };

  const setBookingStatus = async (id, status) => {
    await api.patch(`/admin/bookings/${id}/status`, { status });
    toast.success("Booking updated");
    loadAll();
  };

  const approveTech = async (id) => {
    await api.patch(`/admin/technicians/${id}/status`, { status: "approved" });
    toast.success("Technician approved");
    loadAll();
  };

  const rejectTech = async (id) => {
    if (!window.confirm("Reject this technician application?")) return;
    await api.patch(`/admin/technicians/${id}/status`, { status: "rejected" });
    toast.success("Application rejected");
    loadAll();
  };

  const assignBooking = async (bookingId, techId) => {
    await api.post(`/admin/bookings/${bookingId}/assign`, { tech_id: techId });
    toast.success("Technician assigned");
    setAssignFor(null);
    loadAll();
  };

  const setCustomJobStatus = async (id, status) => {
    await api.patch(`/admin/custom-jobs/${id}/status`, { status });
    toast.success("Request updated");
    loadAll();
  };

  return (
    <div className="space-y-6">
      <header className="card-fix p-5 sm:p-6">
        <div className="blob" style={{ background: "#FFEA00", top: -80, right: -60, opacity: 0.2 }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#FFEA00]">
              <Shield className="h-4 w-4" /> ERTY Control
            </div>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">Operations console</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Approve technicians, assign jobs, manage services, and respond to custom requests from one panel.
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full glass px-4 py-2.5 text-xs font-bold text-white/75"
            data-testid="admin-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </header>

      {loadError && (
        <div className="rounded-2xl border border-[#FF007F]/30 bg-[#FF007F]/10 px-4 py-3 text-sm text-[#FF69B4]">
          {loadError}
        </div>
      )}

      <nav className="glass flex gap-1 overflow-x-auto rounded-full p-1.5 hide-scrollbar" data-testid="admin-tabs">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              data-testid={`admin-tab-${item.id}`}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                tab === item.id ? "bg-[#00E5FF] text-[#05050A]" : "text-white/70 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </nav>

      {["bookings", "technicians", "services", "custom"].includes(tab) && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the current control view"
            className="w-full rounded-full border border-white/10 bg-[#0B0B10] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[#00E5FF] focus:outline-none"
          />
        </div>
      )}

      {tab === "overview" && stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <StatCard icon={Users} label="Users" value={stats.users} color="#00E5FF" />
          <StatCard icon={Wrench} label="Services" value={stats.services} color="#39FF14" />
          <StatCard icon={Hammer} label="Technicians" value={stats.technicians} color="#FFEA00" />
          <StatCard icon={UserCheck} label="Pending techs" value={stats.technicians_pending} color="#FF007F" />
          <StatCard icon={ClipboardList} label="Bookings" value={stats.bookings} color="#FFFFFF" />
          <StatCard icon={BriefcaseBusiness} label="Unassigned" value={stats.bookings_unassigned} color="#FF007F" />
          <StatCard icon={BadgeCheck} label="Diagnoses" value={stats.diagnoses} color="#00E5FF" />
          <StatCard icon={ClipboardPlus} label="Custom requests" value={customJobs.length} color="#FFEA00" />
        </div>
      )}

      {tab === "onboarding" && (
        <div className="space-y-3">
          {pending.length === 0 && <EmptyState title="No pending technician applications" body="New applications will appear here for approval." />}
          {pending.map((tech) => (
            <TechApplication key={tech.tech_id} tech={tech} onApprove={approveTech} onReject={rejectTech} />
          ))}
        </div>
      )}

      {tab === "bookings" && (
        <div className="space-y-3">
          {filteredBookings.length === 0 && <EmptyState title="No bookings found" body="Bookings and assignments will show up here." />}
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.booking_id}
              booking={booking}
              onAssign={() => setAssignFor(booking)}
              onStatus={setBookingStatus}
            />
          ))}
        </div>
      )}

      {tab === "services" && (
        <div className="space-y-3">
          <button
            onClick={() => setShowSvcForm(true)}
            data-testid="add-service-btn"
            className="btn-neon-lime inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold"
          >
            <Plus className="h-4 w-4" /> Add service
          </button>
          {services
            .filter((service) => `${service.name || ""} ${service.category || ""}`.toLowerCase().includes(query.toLowerCase()))
            .map((service) => (
              <ServiceRow key={service.service_id} service={service} onDelete={deleteService} />
            ))}
          {showSvcForm && <ServiceForm onClose={() => setShowSvcForm(false)} onSaved={loadAll} />}
        </div>
      )}

      {tab === "technicians" && (
        <div className="space-y-3">
          <button
            onClick={() => setShowTechForm(true)}
            data-testid="add-tech-btn"
            className="btn-neon-lime inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold"
          >
            <Plus className="h-4 w-4" /> Add technician
          </button>
          {filteredTechs.map((tech) => (
            <TechnicianRow key={tech.tech_id} tech={tech} onDelete={deleteTech} />
          ))}
          {showTechForm && <TechForm onClose={() => setShowTechForm(false)} onSaved={loadAll} />}
        </div>
      )}

      {tab === "custom" && (
        <div className="space-y-3">
          {customJobs.length === 0 && <EmptyState title="No custom requests yet" body="Customers can request ad-hoc jobs from the app." />}
          {customJobs
            .filter((job) => `${job.description || ""} ${job.user_email || ""} ${job.status || ""}`.toLowerCase().includes(query.toLowerCase()))
            .map((job) => (
              <CustomJobCard key={job.job_id} job={job} onStatus={setCustomJobStatus} />
            ))}
        </div>
      )}

      {tab === "outbound" && (
        <div className="space-y-3">
          {outbound.length === 0 && <EmptyState title="No outbound messages yet" body="Assignment emails and SMS logs appear here when available." />}
          {outbound.map((item, index) => (
            <div key={`${item.created_at || "message"}-${index}`} className="card-fix p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00E5FF]/15 text-[#00E5FF]">
                  <MailCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">{item.channel || "message"}</div>
                  <div className="mt-1 text-sm font-semibold">{item.to || item.recipient || "Recipient unavailable"}</div>
                  <div className="mt-1 text-xs text-white/50">{item.subject || item.body || item.status || "No details"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignFor && (
        <AssignModal
          booking={assignFor}
          techs={techs.filter((tech) => tech.status === "approved" && (tech.specializations || []).includes(assignFor.category))}
          onClose={() => setAssignFor(null)}
          onAssign={(techId) => assignBooking(assignFor.booking_id, techId)}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card-fix p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</div>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="mt-3 font-display text-3xl font-black" style={{ color }}>{value ?? 0}</div>
    </div>
  );
}

function TechApplication({ tech, onApprove, onReject }) {
  return (
    <div className="card-fix p-5" data-testid={`pending-tech-${tech.tech_id}`}>
      <div className="flex items-start gap-3">
        <img src={tech.picture} alt={tech.name} className="h-12 w-12 rounded-2xl bg-white/5" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-bold">{tech.name}</div>
          <div className="text-xs text-white/60">{tech.email} {"\u00b7"} {tech.phone}</div>
          <div className="mt-1 text-xs text-white/45">
            {(tech.specializations || []).map(formatCategory).join(", ")} {"\u00b7"} {tech.experience_years}y exp
          </div>
          <div className="mt-1 text-xs text-white/35">
            Base: {(tech.home_lat || 0).toFixed(3)}, {(tech.home_lng || 0).toFixed(3)}
          </div>
        </div>
        <StatusPill status="pending" />
      </div>
      {tech.gov_id_thumb && tech.gov_id_thumb.startsWith("data:image") && (
        <div className="mt-4 max-h-44 overflow-hidden rounded-2xl border border-white/10">
          <img src={tech.gov_id_thumb} alt="Government ID" className="h-full w-full bg-black object-contain" />
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={() => onApprove(tech.tech_id)} data-testid={`approve-tech-${tech.tech_id}`} className="btn-neon-lime rounded-full px-4 py-2 text-xs font-bold">
          Approve
        </button>
        <button onClick={() => onReject(tech.tech_id)} data-testid={`reject-tech-${tech.tech_id}`} className="rounded-full glass px-4 py-2 text-xs font-bold text-[#FF007F]">
          Reject
        </button>
      </div>
    </div>
  );
}

function BookingCard({ booking, onAssign, onStatus }) {
  return (
    <div className="card-fix p-4" data-testid={`admin-bk-${booking.booking_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg font-bold">{booking.service_name}</div>
          <div className="mt-1 text-xs text-white/50">
            {booking.scheduled_date} {"\u00b7"} {booking.scheduled_slot} {"\u00b7"} {formatCategory(booking.category)}
          </div>
          <div className="mt-1 text-xs text-white/40">
            Tech: <span className={booking.tech_name ? "text-white/75" : "text-[#FF007F]"}>{booking.tech_name || "unassigned"}</span>
          </div>
          <div className="mt-2 max-w-2xl truncate text-xs text-white/45">{booking.address}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-xl font-black text-[#39FF14]">{"\u20b9"}{booking.price}</div>
          <StatusPill status={booking.status} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {booking.status === "unassigned" && (
          <button onClick={onAssign} data-testid={`assign-btn-${booking.booking_id}`} className="rounded-full bg-[#FF007F] px-3 py-1 text-[11px] font-bold text-white shadow-[0_0_16px_rgba(255,0,127,0.4)]">
            Assign technician
          </button>
        )}
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => onStatus(booking.booking_id, status)}
            data-testid={`admin-status-${booking.booking_id}-${status}`}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${booking.status === status ? "bg-[#39FF14] text-[#05050A]" : "glass text-white/65"}`}
          >
            {formatStatus(status)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ServiceRow({ service, onDelete }) {
  return (
    <div className="card-fix flex items-center gap-3 p-4" data-testid={`admin-svc-${service.service_id}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#39FF14]/12 text-[#39FF14]">
        <Wrench className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{service.name}</div>
        <div className="truncate text-xs text-white/50">
          {formatCategory(service.category)} {"\u00b7"} from {"\u20b9"}{service.base_price} {"\u00b7"} {(service.tiers || []).length} tier(s)
        </div>
      </div>
      <button onClick={() => onDelete(service.service_id)} data-testid={`delete-svc-${service.service_id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full glass hover:border-[#FF007F]" aria-label="Delete service">
        <Trash2 className="h-4 w-4 text-[#FF007F]" />
      </button>
    </div>
  );
}

function TechnicianRow({ tech, onDelete }) {
  return (
    <div className="card-fix flex items-center gap-3 p-4" data-testid={`admin-tech-${tech.tech_id}`}>
      <img src={tech.picture} alt={tech.name} className="h-11 w-11 rounded-2xl bg-white/5" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{tech.name}</div>
        <div className="truncate text-xs text-white/50">
          Rating {tech.rating} {"\u00b7"} {tech.experience_years}y {"\u00b7"} {(tech.specializations || []).map(formatCategory).join(", ")}
        </div>
      </div>
      <StatusPill status={tech.status || "approved"} />
      <button onClick={() => onDelete(tech.tech_id)} data-testid={`delete-tech-${tech.tech_id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full glass hover:border-[#FF007F]" aria-label="Delete technician">
        <Trash2 className="h-4 w-4 text-[#FF007F]" />
      </button>
    </div>
  );
}

function CustomJobCard({ job, onStatus }) {
  return (
    <div className="card-fix p-5" data-testid={`custom-job-${job.job_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{job.user_name || job.user_email}</div>
          <div className="text-xs text-white/50">{job.user_email} {"\u00b7"} {job.phone}</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/85">{job.description}</div>
          {job.address && <div className="mt-2 text-xs text-white/45">Address: {job.address}</div>}
        </div>
        <StatusPill status={job.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {CUSTOM_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => onStatus(job.job_id, status)}
            data-testid={`custom-status-${job.job_id}-${status}`}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${job.status === status ? "bg-[#39FF14] text-[#05050A]" : "glass text-white/65"}`}
          >
            {formatStatus(status)}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssignModal({ booking, techs, onClose, onAssign }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onClick={onClose} data-testid="assign-modal">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card-fix max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Assign technician</div>
            <div className="mt-1 font-display text-xl font-black">{booking.service_name}</div>
            <div className="mt-1 text-xs text-white/50">{formatCategory(booking.category)} {"\u00b7"} {booking.scheduled_slot}</div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white" data-testid="assign-close"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2">
          {techs.length === 0 && <div className="rounded-2xl border border-white/10 bg-[#0B0B10] p-4 text-sm text-white/50">No approved matching technician yet.</div>}
          {techs.map((tech) => (
            <button key={tech.tech_id} onClick={() => onAssign(tech.tech_id)} data-testid={`assign-choose-${tech.tech_id}`} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#0B0B10] p-3 text-left transition-colors hover:border-[#39FF14]">
              <img src={tech.picture} alt={tech.name} className="h-10 w-10 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{tech.name}</div>
                <div className="text-xs text-white/45">Rating {tech.rating} {"\u00b7"} {tech.experience_years}y</div>
              </div>
              <span className="text-xs font-bold text-[#39FF14]">Assign</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ServiceForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    category: "home_appliances",
    name: "",
    description: "",
    base_price: 499,
    market_min: 699,
    market_max: 1499,
    tier_name: "Basic",
    tier_price: 499,
    tier_features: "Visit, diagnosis, minor adjustment",
  });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Service name required");
      return;
    }
    await api.post("/admin/services", {
      category: form.category,
      name: form.name.trim(),
      description: form.description.trim(),
      icon: "wrench",
      image_url: "",
      base_price: Number(form.base_price),
      market_min: Number(form.market_min) || 0,
      market_max: Number(form.market_max) || 0,
      is_flat_visit: form.category === "handyman",
      tiers: [{
        name: form.tier_name,
        price: Number(form.tier_price),
        features: form.tier_features.split(",").map((item) => item.trim()).filter(Boolean),
      }],
    });
    toast.success("Service created");
    onSaved();
    onClose();
  };

  return (
    <FormModal title="New service" onClose={onClose} onSubmit={submit} testid="service-form">
      <Select label="Category" value={form.category} onChange={(value) => update("category", value)} options={SERVICE_CATEGORIES.map((item) => [item.value, item.label])} />
      <Input label="Service name" value={form.name} onChange={(value) => update("name", value)} testid="svc-name" />
      <Input label="Description" value={form.description} onChange={(value) => update("description", value)} />
      <div className="grid grid-cols-3 gap-2">
        <Input label="Base" type="number" value={form.base_price} onChange={(value) => update("base_price", value)} />
        <Input label="Market min" type="number" value={form.market_min} onChange={(value) => update("market_min", value)} />
        <Input label="Market max" type="number" value={form.market_max} onChange={(value) => update("market_max", value)} />
      </div>
      <div className="border-t border-white/10 pt-3 text-xs uppercase tracking-[0.2em] text-white/50">First tier</div>
      <Input label="Tier name" value={form.tier_name} onChange={(value) => update("tier_name", value)} />
      <Input label="Tier price" type="number" value={form.tier_price} onChange={(value) => update("tier_price", value)} />
      <Input label="Features, comma separated" value={form.tier_features} onChange={(value) => update("tier_features", value)} />
    </FormModal>
  );
}

function TechForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    rating: 4.7,
    experience_years: 3,
    specializations: ["home_appliances"],
    phone: "+91 90000 00000",
    home_lat: 28.4595,
    home_lng: 77.0266,
  });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleCategory = (value) => {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(value)
        ? prev.specializations.filter((item) => item !== value)
        : [...prev.specializations, value],
    }));
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Technician name required");
      return;
    }
    if (form.specializations.length === 0) {
      toast.error("Pick at least one category");
      return;
    }
    await api.post("/admin/technicians", {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(form.name)}`,
      rating: Number(form.rating),
      experience_years: Number(form.experience_years),
      specializations: form.specializations,
      phone: form.phone.trim(),
      is_available: true,
      home_lat: Number(form.home_lat),
      home_lng: Number(form.home_lng),
    });
    toast.success("Technician created");
    onSaved();
    onClose();
  };

  return (
    <FormModal title="New technician" onClose={onClose} onSubmit={submit} testid="tech-form">
      <Input label="Name" value={form.name} onChange={(value) => update("name", value)} testid="tech-name" />
      <Input label="Email" value={form.email} onChange={(value) => update("email", value)} type="email" />
      <Input label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Rating" type="number" value={form.rating} onChange={(value) => update("rating", value)} />
        <Input label="Experience" type="number" value={form.experience_years} onChange={(value) => update("experience_years", value)} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">Specializations</div>
        <div className="mt-2 grid gap-2">
          {SERVICE_CATEGORIES.map((item) => {
            const active = form.specializations.includes(item.value);
            return (
              <button key={item.value} onClick={() => toggleCategory(item.value)} className={`rounded-2xl border px-3 py-2 text-left text-sm font-semibold ${active ? "border-white/30 bg-white/[0.07]" : "border-white/10 bg-[#0B0B10] text-white/65"}`} style={active ? { color: item.color } : {}}>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </FormModal>
  );
}

function FormModal({ title, onClose, onSubmit, children, testid }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onClick={onClose} data-testid={testid}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card-fix max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-display text-xl font-bold">{title}</div>
          <button onClick={onClose} className="text-white/50 hover:text-white" data-testid="modal-close"><X className="h-5 w-5" /></button>
        </div>
        {children}
        <button onClick={onSubmit} data-testid="modal-submit" className="btn-neon-lime mt-3 w-full rounded-full px-6 py-3 text-sm font-bold">
          Save
        </button>
      </motion.div>
    </motion.div>
  );
}

function Input({ label, value, onChange, type = "text", testid }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</span>
      <input
        data-testid={testid}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-[#0B0B10] p-3 text-sm text-white focus:border-[#00E5FF] focus:outline-none"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-white/10 bg-[#0B0B10] p-3 text-sm text-white focus:border-[#00E5FF] focus:outline-none">
        {options.map(([valueOption, labelOption]) => <option key={valueOption} value={valueOption}>{labelOption}</option>)}
      </select>
    </label>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="card-fix p-8 text-center">
      <div className="font-display text-xl font-black">{title}</div>
      <div className="mx-auto mt-2 max-w-sm text-sm text-white/50">{body}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const color = {
    approved: "#39FF14",
    pending: "#FFEA00",
    rejected: "#FF007F",
    unassigned: "#FF007F",
    assigned: "#FFEA00",
    on_the_way: "#00E5FF",
    arrived: "#FF007F",
    in_progress: "#FF007F",
    completed: "#39FF14",
    cancelled: "rgba(255,255,255,0.45)",
    pending_manpower_approval: "#FFEA00",
    fulfilled: "#39FF14",
  }[status] || "rgba(255,255,255,0.55)";

  return (
    <span className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
      {formatStatus(status)}
    </span>
  );
}

function formatStatus(status = "") {
  return status.replace(/_/g, " ");
}

function formatCategory(category = "") {
  return SERVICE_CATEGORIES.find((item) => item.value === category)?.label || category.replace(/_/g, " ");
}

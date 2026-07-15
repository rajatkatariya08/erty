import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  ClipboardCheck,
  Hammer,
  IdCard,
  MapPin,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AddressPickerMap from "../components/AddressPickerMap";

const CATEGORIES = [
  { id: "home_appliances", label: "Home Appliances", sub: "AC, fridge, washer, kitchen gear", color: "#FF007F" },
  { id: "handyman", label: "Handyman & Odd Jobs", sub: "Repairs, fitting, mounting, moving help", color: "#39FF14" },
  { id: "car_and_bike", label: "Car & Bike Repair", sub: "Doorstep vehicle care and small fixes", color: "#00E5FF" },
];

const DEFAULT_CENTER = { lat: 28.4595, lng: 77.0266 };
const DEFAULT_BOUNDS = { lat_min: 28.30, lat_max: 28.60, lng_min: 76.85, lng_max: 77.20 };

export default function TechnicianSignup() {
  const { user, loading, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    experience_years: 1,
    specializations: [],
    gov_id_base64: "",
    gov_id_preview: "",
    home_lat: null,
    home_lng: null,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [area, setArea] = useState({ center: DEFAULT_CENTER, bounds: DEFAULT_BOUNDS });

  useEffect(() => {
    if (!loading && user?.is_technician) navigate("/technician", { replace: true });
    api.get("/service-area")
      .then((res) => setArea(res.data))
      .catch(() => setArea({ center: DEFAULT_CENTER, bounds: DEFAULT_BOUNDS }));
  }, [user, loading, navigate]);

  const completedSteps = useMemo(() => {
    return [
      Boolean(form.name && form.email && form.phone),
      form.specializations.length > 0,
      Boolean(form.gov_id_base64),
      form.home_lat != null,
    ].filter(Boolean).length;
  }, [form]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (id) => {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(id)
        ? prev.specializations.filter((item) => item !== id)
        : [...prev.specializations, id],
    }));
  };

  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        gov_id_base64: reader.result,
        gov_id_preview: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setErr("");
    if (!user) {
      setErr("Sign in with Google first, then submit the technician application.");
      await api.post("/auth/google", { redirectTo: window.location.href });
      return;
    }
    if (!form.name || !form.email || !form.phone) {
      setErr("Complete your name, email, and phone number.");
      return;
    }
    if (form.specializations.length === 0) {
      setErr("Pick at least one service category.");
      return;
    }
    if (!form.gov_id_base64) {
      setErr("Upload a government ID for verification.");
      return;
    }
    if (form.home_lat == null) {
      setErr("Pin your Gurugram base location on the map.");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/tech/signup", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        specializations: form.specializations,
        gov_id_base64: form.gov_id_base64,
        home_lat: form.home_lat,
        home_lng: form.home_lng,
        experience_years: Number(form.experience_years) || 0,
      });
      await checkAuth();
      toast.success("Signup submitted. Admin approval is next.");
      navigate("/technician", { replace: true });
    } catch (error) {
      const detail = error.response?.data?.detail;
      setErr(Array.isArray(detail) ? detail.map((item) => item.msg).join(" | ") : (detail || "Signup failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="bg-mesh" />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <aside className="flex flex-col justify-between gap-8 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
          <div>
            <Link to="/technician/login" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 hover:text-white/70" data-testid="back-to-tech-login">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign-in
            </Link>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-[#39FF14]">
              <Hammer className="h-3.5 w-3.5" /> ERTY Technician Signup
            </div>
            <h1 className="mt-5 font-display text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl">
              Start taking<br />
              <span className="neon-text-lime">doorstep jobs.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
              Apply once, get reviewed by ERTY ops, then accept verified jobs across Gurugram from the technician app.
            </p>
          </div>

          <div className="card-fix p-5">
            <div className="blob" style={{ background: "#39FF14", top: -70, right: -50, opacity: 0.3 }} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.25em] text-white/50">Progress</div>
                <div className="font-display text-2xl font-black text-[#39FF14]">{completedSteps}/4</div>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  ["Profile", "Name, email, phone"],
                  ["Services", "What you can handle"],
                  ["Identity", "Government ID check"],
                  ["Base", "Gurugram map pin"],
                ].map(([title, sub], index) => (
                  <div key={title} className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${completedSteps > index ? "border-[#39FF14] bg-[#39FF14] text-[#05050A]" : "border-white/15 bg-white/[0.04] text-white/40"}`}>
                      {completedSteps > index ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="text-xs text-white/45">{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="space-y-4 pb-8">
          <Section icon={ClipboardCheck} accent="#00E5FF" eyebrow="Step 1" title="Personal details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input testid="signup-name" label="Full name" value={form.name} onChange={(value) => update("name", value)} />
              <Input testid="signup-phone" label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
              <Input testid="signup-email" label="Email" value={form.email} onChange={(value) => update("email", value)} type="email" />
              <Input testid="signup-experience" label="Experience (years)" value={form.experience_years} onChange={(value) => update("experience_years", value)} type="number" />
            </div>
            {!user && (
              <div className="mt-3 rounded-2xl border border-[#39FF14]/25 bg-[#39FF14]/10 px-4 py-3 text-xs text-[#39FF14]">
                You will be asked to sign in with Google before this application is submitted.
              </div>
            )}
          </Section>

          <Section icon={BadgeCheck} accent="#39FF14" eyebrow="Step 2" title="Services you provide">
            <div className="grid gap-3 md:grid-cols-3">
              {CATEGORIES.map((category) => {
                const active = form.specializations.includes(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => toggleCategory(category.id)}
                    data-testid={`signup-cat-${category.id}`}
                    className={`min-h-[136px] rounded-[22px] border p-4 text-left transition-colors ${active ? "bg-white/[0.07] border-white/30" : "bg-[#0B0B10] border-white/10 hover:border-white/25"}`}
                    style={active ? { boxShadow: `0 0 24px ${category.color}33` } : {}}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: category.color }}>Category</div>
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-[#39FF14] text-[#05050A]" : "bg-white/[0.06] text-white/35"}`}>
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 font-display text-lg font-black leading-tight">{category.label}</div>
                    <div className="mt-2 text-xs leading-5 text-white/50">{category.sub}</div>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section icon={IdCard} accent="#FFEA00" eyebrow="Step 3" title="Identity verification">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-[#0B0B10] px-4 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{form.gov_id_base64 ? "ID document selected" : "Upload Aadhaar, PAN, or Driving Licence"}</div>
                <div className="mt-1 text-xs text-white/45">JPEG, PNG, or PDF. Maximum 5 MB.</div>
              </div>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={onFile} data-testid="signup-gov-id" />
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#FFEA00] px-4 py-2 text-xs font-bold text-[#05050A]">
                <Upload className="h-4 w-4" /> {form.gov_id_base64 ? "Replace" : "Choose"}
              </span>
            </label>
            {form.gov_id_preview && form.gov_id_preview.startsWith("data:image") && (
              <div className="mt-3 max-h-52 overflow-hidden rounded-[22px] border border-white/10" data-testid="gov-id-preview">
                <img src={form.gov_id_preview} alt="Government ID preview" className="h-full w-full bg-black object-contain" />
              </div>
            )}
          </Section>

          <Section icon={MapPin} accent="#FF007F" eyebrow="Step 4" title="Base location">
            <AddressPickerMap
              center={area.center || DEFAULT_CENTER}
              bounds={area.bounds || DEFAULT_BOUNDS}
              coords={form.home_lat != null ? { lat: form.home_lat, lng: form.home_lng } : null}
              onCoordsChange={(lat, lng) => setForm((prev) => ({ ...prev, home_lat: lat, home_lng: lng }))}
              onAddressChange={() => {}}
              onOutOfArea={() => toast.error("Base must be within Gurugram, Haryana")}
            />
            {form.home_lat != null && (
              <div className="text-[11px] text-white/45" data-testid="signup-coords">
                GPS: {form.home_lat.toFixed(5)}, {form.home_lng.toFixed(5)}
              </div>
            )}
          </Section>

          {err && (
            <div data-testid="signup-error" className="inline-flex items-center gap-2 rounded-2xl border border-[#FF007F]/30 bg-[#FF007F]/10 px-4 py-3 text-sm text-[#FF69B4]">
              <AlertTriangle className="h-4 w-4" /> {err}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy}
            data-testid="signup-submit"
            className="btn-neon-lime inline-flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-bold disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" /> {busy ? "Submitting..." : "Submit for admin approval"}
          </button>
        </main>
      </div>
    </div>
  );
}

function Section({ icon: Icon, accent, eyebrow, title, children }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card-fix p-5 sm:p-6">
      <div className="blob" style={{ background: accent, top: -75, right: -55, opacity: 0.18 }} />
      <div className="relative">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em]" style={{ color: accent }}>
          <Icon className="h-4 w-4" /> {eyebrow}
        </div>
        <h2 className="mt-2 font-display text-2xl font-black">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </motion.section>
  );
}

function Input({ label, value, onChange, type = "text", testid }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">{label}</span>
      <input
        data-testid={testid}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-[#0B0B10] p-3 text-sm text-white placeholder:text-white/25 focus:border-[#39FF14] focus:outline-none"
      />
    </label>
  );
}

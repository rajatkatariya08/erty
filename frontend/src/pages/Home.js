import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ScanLine, ArrowRight, Sparkles, Hammer, Car,
  WashingMachine, UserRoundCog, Sparkles as SparklesIcon,
  Search, ShieldCheck, WalletCards, Clock3, BadgeCheck,
  MapPin, Headphones, CalendarCheck, ChevronRight, Wrench,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import CustomJobRequestModal from "../components/CustomJobRequestModal";

const FALLBACK_CATEGORIES = [
  { id: "home_appliances", label: "Home Appliances", tagline: "Repair \u00b7 Install \u00b7 Service", coming_soon: false },
  { id: "handyman", label: "Handyman & Odd Jobs", tagline: "\u20b9100 booking fee", booking_fee: 100, coming_soon: false },
  { id: "car_and_bike", label: "Car & Bike Repair", tagline: "Doorstep vehicle care", coming_soon: false },
  { id: "permanent_drivers", label: "Permanent Drivers", tagline: "Monthly \u00b7 Full-time", coming_soon: true },
  { id: "domestic_maids", label: "Domestic Maids", tagline: "Verified housekeeping", coming_soon: true },
];

const PILLAR_META = {
  home_appliances: { Ic: WashingMachine, blob: "#FF007F", glow: "0 0 44px rgba(255,0,127,0.34)", image: "/images/category-home-appliances.png" },
  handyman: { Ic: Hammer, blob: "#39FF14", glow: "0 0 44px rgba(57,255,20,0.32)", image: "/images/category-handyman.png" },
  car_and_bike: { Ic: Car, blob: "#00E5FF", glow: "0 0 44px rgba(0,229,255,0.34)", image: "/images/category-car-bike.png" },
  permanent_drivers: { Ic: UserRoundCog, blob: "#FFEA00", glow: "0 0 40px rgba(255,234,0,0.28)", image: "/images/category-drivers.png" },
  domestic_maids: { Ic: SparklesIcon, blob: "#E879F9", glow: "0 0 40px rgba(232,121,249,0.28)", image: "/images/category-maids.png" },
};

const TRUST_ITEMS = [
  { label: "Verified technicians", detail: "Profile checked", Icon: ShieldCheck, color: "#39FF14" },
  { label: "Upfront pricing", detail: "Before you book", Icon: BadgeCheck, color: "#00E5FF" },
  { label: "Pay on service", detail: "No surprise fees", Icon: WalletCards, color: "#FFEA00" },
  { label: "Same-day slots", detail: "Gurugram first", Icon: Clock3, color: "#FF007F" },
];

const POPULAR_PRIORITY = [
  "TV Wall Mounting",
  "Bathroom Fittings",
  "AC Repair",
  "RO System Service",
  "Bike Roadside Fix",
  "Car Battery Jumpstart",
  "Doorstep Bike Service",
  "Car General Service",
];

const FALLBACK_POPULAR = [
  { service_id: "home_appliances", category: "home_appliances", name: "AC Repair", base_price: 599, icon: "air-vent" },
  { service_id: "handyman", category: "handyman", name: "TV Wall Mounting", base_price: 249, booking_fee: 100, icon: "tv" },
  { service_id: "home_appliances_ro", category: "home_appliances", name: "RO System Service", base_price: 449, icon: "droplets" },
  { service_id: "car_and_bike", category: "car_and_bike", name: "Doorstep Bike Service", base_price: 599, icon: "bike" },
];

function getPopularServices(services) {
  const byName = new Map((services || []).map((svc) => [svc.name, svc]));
  const picked = POPULAR_PRIORITY.map((name) => byName.get(name)).filter(Boolean);
  const used = new Set(picked.map((svc) => svc.service_id));
  const filler = (services || []).filter((svc) => !used.has(svc.service_id)).slice(0, Math.max(0, 6 - picked.length));
  const list = [...picked, ...filler].slice(0, 6);
  return list.length ? list : FALLBACK_POPULAR;
}

function PillarTile({ cat, i, onClick }) {
  const meta = PILLAR_META[cat.id] || PILLAR_META.home_appliances;
  const Ic = meta.Ic;
  const { t } = useLang();
  const labelKey = {
    home_appliances: ["home_appliances", "home_appliances_tag"],
    handyman: ["handyman", "handyman_tag"],
    car_and_bike: ["car_bike", "car_bike_tag"],
    permanent_drivers: ["drivers", "drivers_tag"],
    domestic_maids: ["maids", "maids_tag"],
  }[cat.id] || [cat.label, cat.tagline];
  const large = i === 0;

  return (
    <motion.button
      onClick={onClick}
      disabled={cat.coming_soon}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      data-testid={`pillar-${cat.id}`}
      className={`card-fix relative overflow-hidden p-5 text-left transition-colors hover:border-white/25 ${
        large ? "col-span-2 min-h-[200px] lg:col-span-2" : "min-h-[176px] lg:col-span-1"
      } ${cat.coming_soon ? "cursor-default" : "cursor-pointer"}`}
      style={{ boxShadow: meta.glow }}
    >
      <img src={meta.image} alt="" aria-hidden="true" className="pillar-image" />
      <div className="pillar-image-shade" />
      <div className="blob" style={{ background: meta.blob, top: -60, right: -40, opacity: 0.45 }} />
      <div className="relative flex h-full flex-col">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]" style={{ color: meta.blob }}>
          <Ic className="h-6 w-6" />
        </div>
        <div className="mt-3 text-[10px] uppercase tracking-[0.28em] text-white/50">{t("category")}</div>
        <div className="mt-1 font-display text-xl font-black leading-tight sm:text-2xl">{t(labelKey[0])}</div>
        <div className="mt-1 text-xs text-white/60">{t(labelKey[1])}</div>
        <div className="mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-semibold" style={{ color: cat.coming_soon ? "rgba(255,255,255,0.5)" : meta.blob }}>
          {cat.coming_soon ? t("coming_soon") : <>Explore {"\u2192"}</>}
        </div>
      </div>

      {cat.coming_soon && (
        <div
          data-testid={`coming-soon-${cat.id}`}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-md"
        >
          <div className="rounded-full border border-white/20 bg-white/[0.06] px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-white/90 shadow-[0_0_24px_rgba(255,255,255,0.15)]">
            {t("coming_soon")}
          </div>
        </div>
      )}
    </motion.button>
  );
}

function SectionHeader({ kicker, title, body, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-white/45">{kicker}</div>
        <h2 className="mt-1 font-display text-2xl font-black leading-tight">{title}</h2>
        {body && <p className="mt-1 max-w-xl text-sm text-white/60">{body}</p>}
      </div>
      {action}
    </div>
  );
}

function TrustStrip() {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="trust-strip">
      {TRUST_ITEMS.map(({ label, detail, Icon, color }) => (
        <div key={label} className="card-fix p-4">
          <div className="relative">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.06]" style={{ color }}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-sm font-bold leading-tight">{label}</div>
            <div className="mt-1 text-xs text-white/50">{detail}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

function PopularServiceCard({ svc, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="card-fix min-h-[138px] p-4 text-left transition-colors hover:border-white/25"
      data-testid={`popular-service-${svc.service_id}`}
    >
      <div className="blob" style={{ background: "#00E5FF", top: -80, right: -70, opacity: 0.25 }} />
      <div className="relative flex h-full flex-col">
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{svc.category?.replaceAll("_", " ")}</div>
        <div className="mt-2 font-display text-lg font-black leading-tight">{svc.name}</div>
        <div className="mt-2 text-xs text-white/55">
          Starts at <span className="font-bold text-[#39FF14]">{"\u20b9"}{svc.base_price || 0}</span>
          {svc.booking_fee ? <span> + {"\u20b9"}{svc.booking_fee} booking</span> : null}
        </div>
        <div className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-[#00E5FF]">
          Book now <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Choose service", body: "Pick a repair, install, or custom job.", Icon: Search },
    { title: "Book a slot", body: "Select address, date, and the right tier.", Icon: CalendarCheck },
    { title: "Technician visits", body: "A verified partner arrives with tools.", Icon: Wrench },
    { title: "Pay after service", body: "Review the work and complete payment.", Icon: WalletCards },
  ];

  return (
    <section data-testid="how-it-works-section">
      <SectionHeader
        kicker="Simple flow"
        title="Book in four steps"
        body="Designed for quick home repairs without the back-and-forth calls."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(({ title, body, Icon }, index) => (
          <div key={title} className="card-fix p-4">
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-[#39FF14]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="font-display text-2xl font-black text-white/15">0{index + 1}</div>
              </div>
              <div className="font-bold">{title}</div>
              <div className="mt-1 text-xs leading-relaxed text-white/55">{body}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    api.get("/categories")
      .then(r => setCategories(r.data?.length ? r.data : FALLBACK_CATEGORIES))
      .catch(() => setCategories(FALLBACK_CATEGORIES));
    api.get("/services")
      .then(r => setServices(r.data || []))
      .catch(() => setServices([]));
  }, []);

  const popularServices = getPopularServices(services);
  const searchTerm = query.trim().toLowerCase();
  const searchResults = searchTerm
    ? services.filter((svc) => svc.name.toLowerCase().includes(searchTerm)).slice(0, 5)
    : [];

  function openService(svc) {
    if (svc.service_id?.startsWith("svc_") || services.some((item) => item.service_id === svc.service_id)) {
      navigate(`/service/${svc.service_id}`);
      return;
    }
    navigate(`/category/${svc.category || svc.service_id}`);
  }

  function submitSearch(event) {
    event.preventDefault();
    if (searchResults[0]) {
      openService(searchResults[0]);
      return;
    }
    const matchedCategory = categories.find((cat) => cat.label?.toLowerCase().includes(searchTerm));
    if (matchedCategory && !matchedCategory.coming_soon) navigate(`/category/${matchedCategory.id}`);
  }

  return (
    <div className="space-y-8 pb-4">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-white/50">
            {t("greeting")}, {user?.name?.split(" ")[0] || ""} <span aria-hidden="true">{"\u00b7"}</span> {t("city")}
          </div>
          <h1 className="mt-1 font-display text-3xl font-black leading-[1.04] tracking-tight sm:text-[38px]">
            {t("hero_1")}<br /><span className="neon-text-lime">{t("hero_2")}</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              <MapPin className="h-3.5 w-3.5 text-[#00E5FF]" /> Gurugram
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              <Headphones className="h-3.5 w-3.5 text-[#FFEA00]" /> Support ready
            </span>
          </div>
        </div>
        {user?.picture && (
          <img src={user.picture} alt="me" className="h-11 w-11 rounded-full border border-white/20" data-testid="profile-avatar" />
        )}
      </header>

      <form onSubmit={submitSearch} className="card-fix p-3" data-testid="home-search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search AC, RO, TV mounting, bike fix..."
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-4 text-sm text-white placeholder:text-white/35"
          />
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-white/10 bg-[#111116] shadow-2xl">
              {searchResults.map((svc) => (
                <button
                  key={svc.service_id}
                  type="button"
                  onClick={() => openService(svc)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-white/[0.06]"
                >
                  <span>{svc.name}</span>
                  <span className="text-xs text-[#39FF14]">{"\u20b9"}{svc.base_price}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      <TrustStrip />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-fix p-6 sm:p-7" data-testid="ai-diagnose-cta">
        <div className="blob" style={{ background: "#00E5FF", top: -60, right: -40 }} />
        <div className="blob" style={{ background: "#FF007F", bottom: -80, left: -40 }} />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#00E5FF]">
              <Sparkles className="h-3.5 w-3.5" /> {t("ai_kicker")}
            </div>
            <h2 className="mt-3 font-display text-2xl font-black leading-tight sm:text-[31px]">{t("ai_title")}</h2>
            <p className="mt-2 max-w-md text-sm text-white/70">{t("ai_body")}</p>
          </div>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
            <ScanLine className="h-14 w-14 text-[#39FF14]" />
          </motion.div>
        </div>
        <button onClick={() => navigate("/diagnose")} data-testid="start-ai-diagnose-btn" className="btn-neon-blue mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
          {t("ai_cta")} <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>

      <section data-testid="popular-services-section">
        <SectionHeader
          kicker="Popular now"
          title="Fast fixes people book most"
          body="A shorter path for the jobs customers usually need in a hurry."
          action={
            <button onClick={() => navigate("/category/handyman")} className="hidden text-xs font-semibold text-[#39FF14] sm:inline-flex">
              Browse all
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {popularServices.map((svc) => (
            <PopularServiceCard key={svc.service_id} svc={svc} onOpen={() => openService(svc)} />
          ))}
        </div>
      </section>

      <section data-testid="pillars-section">
        <SectionHeader
          kicker="Categories"
          title="Choose the kind of help"
          body="Repair, install, service, or ask us for a custom task."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c, i) => (
            <PillarTile
              key={c.id}
              cat={c}
              i={i}
              onClick={() => !c.coming_soon && navigate(`/category/${c.id}`)}
            />
          ))}
        </div>
      </section>

      <HowItWorks />

      <section className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => navigate("/diagnose")}
          className="card-fix p-5 text-left transition-colors hover:border-[#00E5FF]/40"
          data-testid="home-ai-secondary"
        >
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#00E5FF]">Not sure?</div>
            <div className="mt-2 font-display text-xl font-black">Let AI inspect the problem</div>
            <p className="mt-2 text-sm text-white/60">Upload a photo and get a guided estimate before booking.</p>
          </div>
        </button>
        <button
          onClick={() => setModalOpen(true)}
          className="card-fix p-5 text-left transition-colors hover:border-[#FF007F]/40"
          data-testid="home-custom-request"
        >
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#FF007F]">Custom job</div>
            <div className="mt-2 font-display text-xl font-black">Can't find your exact task?</div>
            <p className="mt-2 text-sm text-white/60">Send a request and the admin team can review it.</p>
          </div>
        </button>
      </section>

      <CustomJobRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

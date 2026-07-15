import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ScanLine, ArrowRight, Sparkles, Hammer, Car,
  WashingMachine, UserRoundCog, Sparkles as SparklesIcon,
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
  home_appliances: { Ic: WashingMachine, blob: "#FF007F", glow: "0 0 44px rgba(255,0,127,0.34)" },
  handyman: { Ic: Hammer, blob: "#39FF14", glow: "0 0 44px rgba(57,255,20,0.32)" },
  car_and_bike: { Ic: Car, blob: "#00E5FF", glow: "0 0 44px rgba(0,229,255,0.34)" },
  permanent_drivers: { Ic: UserRoundCog, blob: "#FFEA00", glow: "0 0 40px rgba(255,234,0,0.28)" },
  domestic_maids: { Ic: SparklesIcon, blob: "#E879F9", glow: "0 0 40px rgba(232,121,249,0.28)" },
};

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
        large ? "col-span-2 min-h-[200px]" : "min-h-[176px]"
      } ${cat.coming_soon ? "cursor-default" : "cursor-pointer"}`}
      style={{ boxShadow: meta.glow }}
    >
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

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    api.get("/categories")
      .then(r => setCategories(r.data?.length ? r.data : FALLBACK_CATEGORIES))
      .catch(() => setCategories(FALLBACK_CATEGORIES));
  }, []);

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/50">
            {t("greeting")}, {user?.name?.split(" ")[0] || ""} <span aria-hidden="true">{"\u00b7"}</span> {t("city")}
          </div>
          <h1 className="mt-1 font-display text-3xl font-black leading-[1.04] tracking-tight sm:text-[38px]">
            {t("hero_1")}<br /><span className="neon-text-lime">{t("hero_2")}</span>
          </h1>
        </div>
        {user?.picture && (
          <img src={user.picture} alt="me" className="h-11 w-11 rounded-full border border-white/20" data-testid="profile-avatar" />
        )}
      </header>

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

      <section data-testid="pillars-section">
        <div className="grid grid-cols-2 gap-3">
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

      <CustomJobRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Wrench, WashingMachine, Refrigerator, Tv, Microwave, Flame,
  Droplets, CookingPot, Wind, Utensils, CircleDot, Snowflake, AirVent,
  Blinds, ShowerHead, Package, Image as ImgIcon, Lightbulb, Fan, Lock,
  Car, Bike, BatteryCharging,
} from "lucide-react";
import { api } from "../lib/api";
import { useLang } from "../context/LangContext";
import CustomJobRequestModal from "../components/CustomJobRequestModal";

const ICON_MAP = {
  "droplets": Droplets, "cooking-pot": CookingPot, "wind": Wind, "utensils": Utensils,
  "circle-dot": CircleDot, "snowflake": Snowflake, "air-vent": AirVent,
  "washing-machine": WashingMachine, "refrigerator": Refrigerator, "tv": Tv,
  "microwave": Microwave, "flame": Flame,
  "blinds": Blinds, "shower-head": ShowerHead, "package": Package, "image": ImgIcon,
  "lightbulb": Lightbulb, "fan": Fan, "lock": Lock, "wrench": Wrench,
  "car": Car, "bike": Bike, "battery-charging": BatteryCharging,
};

const SERVICE_IMAGE_MAP = {
  svc_ac_repair: "/images/service-ac-repair.png",
  svc_ro_service: "/images/service-ro-service.png",
  svc_washing_machine: "/images/service-washing-machine.png",
  svc_tv_mounting: "/images/service-tv-mounting.png",
  svc_fan_install: "/images/service-ceiling-fan.png",
  svc_bathroom_fittings: "/images/service-bathroom-fittings.png",
};

function tileColor(idx) {
  return ["#FF007F", "#00E5FF", "#39FF14", "#FFEA00"][idx % 4];
}

function ServiceTile({ svc, index, showBookingFee }) {
  const Ic = ICON_MAP[svc.icon] || Wrench;
  const image = SERVICE_IMAGE_MAP[svc.service_id] || svc.image_url;
  const color = tileColor(index);
  const { t } = useLang();
  const savings = svc.market_max && svc.market_max > svc.base_price
    ? Math.round(((svc.market_max - svc.base_price) / svc.market_max) * 100)
    : 0;
  return (
    <Link
      to={`/service/${svc.service_id}`}
      data-testid={`service-tile-${svc.service_id}`}
      className="card-fix block h-full p-4 hover:border-white/25 transition-colors relative overflow-hidden"
    >
      {image && <img src={image} alt="" aria-hidden="true" className="service-tile-image" />}
      {image && <div className="service-tile-image-shade" />}
      <div className="blob" style={{ background: color, top: -40, right: -30, opacity: 0.4 }} />
      <div className="relative z-[2] text-white">
        <div className="h-10 w-10 rounded-2xl bg-white/[0.06] flex items-center justify-center" style={{ color }}>
          <Ic className="h-5 w-5" />
        </div>
        <div className="mt-3 font-display text-sm sm:text-base font-bold leading-tight">{svc.name}</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/65">{t("from")}</span>
          <span className="font-display text-lg font-black text-[#39FF14]">₹{svc.base_price}</span>
        </div>
        {showBookingFee && svc.booking_fee > 0 && (
          <div
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#10B981]/25 border border-[#10B981]/45 px-2 py-0.5 text-[10px] font-semibold text-[#6EE7B7]"
            data-testid={`booking-fee-${svc.service_id}`}
          >
            {t("booking_fee")}: ₹{svc.booking_fee}
          </div>
        )}
        {savings > 15 && (
          <div className="mt-1 text-[10px] text-[#FFEA00]">
            {t("save_up_to")} {savings}% vs ₹{svc.market_max} {t("market")}
          </div>
        )}
      </div>
    </Link>
  );
}

function CustomJobBento({ onOpen }) {
  const { t } = useLang();
  return (
    <button
      onClick={onOpen}
      data-testid="custom-job-bento"
      className="col-span-2 sm:col-span-3 relative overflow-hidden rounded-3xl p-6 text-left transition-transform hover:scale-[1.01] border border-purple-500/30"
      style={{
        background: "linear-gradient(135deg, #2E1065 0%, #4C1D95 45%, #831843 100%)",
        boxShadow: "0 20px 60px rgba(139,92,246,0.25), inset 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <div className="absolute -top-16 -right-20 h-56 w-56 rounded-full" style={{ background: "#F43F5E", filter: "blur(80px)", opacity: 0.4 }} />
      <div className="absolute -bottom-16 -left-16 h-52 w-52 rounded-full" style={{ background: "#8B5CF6", filter: "blur(70px)", opacity: 0.45 }} />
      <div className="relative flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-[0_0_24px_rgba(244,63,94,0.5)]">
          <Plus className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/70">{t("custom_kicker")}</div>
          <div className="mt-1 font-display text-lg sm:text-xl font-black">{t("custom_headline")}</div>
          <div className="mt-1 text-sm text-white/70">{t("custom_sub")}</div>
        </div>
      </div>
    </button>
  );
}

const CATEGORY_LABEL = {
  home_appliances: "home_appliances", handyman: "handyman", car_and_bike: "car_bike",
  permanent_drivers: "drivers", domestic_maids: "maids",
};

export default function CategoryPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [services, setServices] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    api.get(`/services?category=${categoryId}`).then(r => setServices(r.data));
  }, [categoryId]);

  const showBookingFee = categoryId === "handyman";
  const labelKey = CATEGORY_LABEL[categoryId] || categoryId;

  return (
    <div className="space-y-6 min-h-[calc(100vh-140px)]">
      <button onClick={() => navigate("/app")} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white" data-testid="back-home">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="font-display text-4xl font-black tracking-tight" data-testid="category-title">{t(labelKey)}</h1>
      {showBookingFee && (
        <div className="rounded-2xl border border-[#10B981]/30 bg-[#10B981]/8 px-4 py-3 text-sm text-[#10B981]" data-testid="booking-fee-banner">
          <b>{t("booking_fee")} ₹100</b> secures your appointment. Service prices shown are <b>starting</b> — parts extra at cost.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {services.map((s, i) => (
          <ServiceTile key={s.service_id} svc={s} index={i} showBookingFee={showBookingFee} />
        ))}
        <CustomJobBento onOpen={() => setModalOpen(true)} />
      </div>

      <CustomJobRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

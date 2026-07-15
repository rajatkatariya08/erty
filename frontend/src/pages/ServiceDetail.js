import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Check, ScanLine } from "lucide-react";
import { api } from "../lib/api";
import { motion } from "framer-motion";

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);

  useEffect(() => {
    api.get(`/services/${serviceId}`).then(r => {
      setService(r.data);
      setSelectedTier(r.data.tiers?.[0]?.name);
    });
  }, [serviceId]);

  if (!service) return <div className="text-white/60">Loading…</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white" data-testid="back-btn">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="card-fix p-6">
        <div className="blob" style={{ background: "#00E5FF", top: -60, right: -40 }} />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.25em] text-[#00E5FF]">{service.category.replace("_", " ")}</div>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-black tracking-tight" data-testid="service-title">{service.name}</h1>
          <p className="mt-3 text-white/70 text-sm max-w-xl">{service.description}</p>
        </div>
      </div>

      {/* Price Optimizer */}
      {(service.market_min || service.market_max) && (
        <div className="card-fix p-5" data-testid="price-optimizer">
          <div className="blob" style={{ background: "#FFEA00", top: -40, right: -20, opacity: 0.4 }} />
          <div className="relative">
            <div className="text-xs uppercase tracking-[0.2em] text-[#FFEA00]">Price Optimizer · Gurugram baseline</div>
            <div className="mt-3 flex items-baseline gap-4 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40">Our starting</div>
                <div className="font-display text-3xl font-black neon-text-lime">₹{service.base_price}</div>
              </div>
              <div className="text-white/25 text-2xl font-light">vs</div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40">Market range</div>
                <div className="font-display text-lg font-bold text-white/70">₹{service.market_min} – ₹{service.market_max}</div>
              </div>
              {service.market_max > service.base_price && (
                <div className="rounded-full bg-[#39FF14]/15 text-[#39FF14] text-xs font-bold uppercase tracking-widest px-3 py-1">
                  Save up to {Math.round(((service.market_max - service.base_price) / service.market_max) * 100)}%
                </div>
              )}
            </div>
            {service.is_flat_visit && (
              <div className="mt-3 text-xs text-white/60">
                <span className="text-[#39FF14] font-semibold">₹100 flat visit fee</span> — parts, if any, are charged at cost.
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-xl font-bold mb-3">Choose a plan</h2>
        <div className="space-y-3">
          {service.tiers.map((t, i) => {
            const active = selectedTier === t.name;
            return (
              <motion.button
                key={t.name}
                onClick={() => setSelectedTier(t.name)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                data-testid={`tier-${t.name.replace(/\s+/g, "-").toLowerCase()}`}
                className={`w-full text-left card-fix p-5 border transition-colors ${
                  active ? "border-[#39FF14] shadow-[0_0_24px_rgba(57,255,20,0.25)]" : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-lg font-bold">{t.name}</div>
                  <div className={`font-display text-2xl font-black ${active ? "neon-text-lime" : ""}`}>₹{t.price}</div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {t.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className={`h-4 w-4 ${active ? "text-[#39FF14]" : "text-white/40"}`} /> {f}
                    </li>
                  ))}
                </ul>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate(`/book/${service.service_id}?tier=${encodeURIComponent(selectedTier)}`)}
          className="btn-neon-lime rounded-full px-6 py-3.5 font-semibold text-sm flex-1"
          data-testid="book-now-btn"
        >
          Book Now
        </button>
        <Link
          to={`/diagnose?category=${service.category}`}
          data-testid="try-ai-diagnose-btn"
          className="rounded-full glass px-6 py-3.5 font-semibold text-sm inline-flex items-center justify-center gap-2 text-white"
        >
          <ScanLine className="h-4 w-4 text-[#00E5FF]" /> Try AI Diagnose
        </Link>
      </div>
    </div>
  );
}

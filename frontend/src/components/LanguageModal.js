import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Languages, Check } from "lucide-react";
import { useLang } from "../context/LangContext";

const OPTIONS = [
  { code: "en", label: "English",   sub: "Continue in English" },
  { code: "hi", label: "हिन्दी",     sub: "हिन्दी में जारी रखें" },
  { code: "hr", label: "Haryanvi",  sub: "हरियाणवी मैं आगै बढ़" },
];

export default function LanguageModal() {
  const { lang, setLang, t, showModal, setShowModal } = useLang();

  const pick = (code) => {
    setLang(code);
    // Give the user a beat to see the emerald border light up before we close.
    setTimeout(() => setShowModal(false), 260);
  };

  return createPortal(
    <AnimatePresence>
      {showModal && (
        <motion.div
          key="lang-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] backdrop-blur-lg bg-black/40 flex items-end sm:items-center justify-center p-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
          data-testid="language-modal"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0d13]/90 backdrop-blur-xl p-6 shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[#10B981]">
              <Languages className="h-3.5 w-3.5" /> Language
            </div>
            <h2 className="mt-3 font-display text-2xl sm:text-3xl font-black tracking-tight" data-testid="lang-title">
              {t("lang_title")}
            </h2>
            <p className="mt-1.5 text-sm text-white/60">{t("lang_sub")}</p>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {OPTIONS.map(o => {
                const active = lang === o.code;
                return (
                  <button
                    key={o.code}
                    onClick={() => pick(o.code)}
                    data-testid={`lang-option-${o.code}`}
                    className={`text-left rounded-2xl p-4 transition-transform hover:scale-105 border ${
                      active
                        ? "border-[#10B981] bg-[#10B981]/8"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                    style={active ? { boxShadow: "0 0 24px rgba(16,185,129,0.35), inset 0 0 0 1px rgba(16,185,129,0.5)" } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-display text-lg font-bold">{o.label}</div>
                        <div className="text-xs text-white/50 mt-0.5">{o.sub}</div>
                      </div>
                      {active && (
                        <div className="h-8 w-8 rounded-full bg-[#10B981] text-black flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.6)]">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowModal(false)}
              data-testid="lang-continue"
              className="mt-6 w-full rounded-full py-3 font-semibold text-sm text-[#05050A]"
              style={{ background: "#10B981", boxShadow: "0 0 22px rgba(16,185,129,0.35)" }}
            >
              {t("lang_cta")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

import { motion } from "framer-motion";
import { Wrench, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

const CATEGORIES = [
  { c: "text-[#FF007F]", t: "Appliances" },
  { c: "text-[#39FF14]", t: "Bikes" },
  { c: "text-[#00E5FF]", t: "Cars" },
  { c: "text-[#FFEA00]", t: "Installation" },
];

export default function Login() {
  const { user, loading, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  const startGoogle = async () => {
    setAuthError("");
    setBusy(true);
    try {
      await api.post("/auth/google", { redirectTo: window.location.origin });
      await checkAuth();
    } catch (error) {
      setAuthError(error.response?.data?.detail || "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="bg-mesh" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[690px] flex-col items-start justify-center px-5 sm:px-0">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/70" data-testid="app-badge">
            <Sparkles className="h-3.5 w-3.5 text-[#39FF14]" />
            ERTY <span aria-hidden="true">{"\u00b7"}</span> Executing Rapid Tasks For You
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-[72px]"
          data-testid="login-title"
        >
          Rapid tasks.<br />
          <span className="neon-text-lime">At your door.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-7 max-w-[560px] text-base leading-8 text-white/60 sm:text-[19px]"
        >
          ERTY sends a trusted technician to your doorstep {"\u2014"} appliances,
          bikes, cars, installations, handyman. Or try our AI diagnosis {"\u2014"}
          snap a photo, get an instant estimate.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
        >
          <button
            onClick={startGoogle}
            disabled={busy || !GOOGLE_CLIENT_ID}
            data-testid="google-login-btn"
            className="btn-neon-lime inline-flex min-h-[56px] items-center justify-center gap-3 rounded-full px-7 py-4 text-sm font-bold disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> {busy ? "Opening Google..." : "Continue with Google"}
          </button>
          {!GOOGLE_CLIENT_ID && (
            <div className="rounded-full border border-[#FF007F]/30 bg-[#FF007F]/10 px-4 py-3 text-sm text-[#FF69B4]">
              Google Client ID missing
            </div>
          )}
          <div className="inline-flex items-center gap-2 rounded-full glass px-6 py-4 text-sm text-white/60">
            <Wrench className="h-4 w-4 text-[#FF007F]" /> Pay on service
          </div>
        </motion.div>

        {authError && (
          <div className="mt-4 rounded-2xl border border-[#FF007F]/30 bg-[#FF007F]/10 px-4 py-3 text-sm text-[#FF69B4]">
            {authError}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 flex flex-wrap gap-4 text-xs text-white/40"
        >
          <a href="/technician/login" data-testid="link-tech-login" className="text-[#39FF14] hover:text-white">Technician sign-in {"\u2192"}</a>
          <a href="/admin/login" data-testid="link-admin-login" className="text-[#FFEA00] hover:text-white">Admin sign-in {"\u2192"}</a>
        </motion.div>

        <div className="mt-14 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((s, i) => (
            <motion.div
              key={s.t}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.08 }}
              className="glass rounded-2xl px-4 py-3 text-sm"
            >
              <div className={`text-xs uppercase tracking-[0.2em] ${s.c}`}>Cat</div>
              <div className="mt-1 font-semibold">{s.t}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Lock, Shield } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function AdminLogin() {
  const { user, loading, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && user?.is_admin) navigate("/admin", { replace: true });
  }, [user, loading, navigate]);

  const submit = async (event) => {
    event?.preventDefault?.();
    setBusy(true);
    setErr("");
    try {
      await api.post("/auth/admin/login");
      await checkAuth();
      toast.success("Opening Google sign-in");
    } catch (error) {
      setErr(error.response?.data?.detail || "Login failed");
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="bg-mesh" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md space-y-6">
          <div>
            <Link to="/login" className="text-xs uppercase tracking-widest text-white/40 hover:text-white/70" data-testid="back-to-customer-login">
              {"\u2190"} Customer login
            </Link>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-[#FFEA00]">
              <Shield className="h-3.5 w-3.5" /> Admin Portal
            </div>
            <h1 className="mt-4 font-display text-4xl font-black tracking-tight sm:text-5xl" data-testid="admin-login-title">
              ERTY<br /><span className="neon-text-yellow">Operations</span>
            </h1>
            <p className="mt-3 text-sm text-white/60">
              Restricted access for the ERTY control panel.
            </p>
          </div>

          <form onSubmit={submit} className="card-fix space-y-4 p-6">
            <div className="blob" style={{ background: "#FFEA00", top: -60, right: -40 }} />
            <div className="relative space-y-4">
              <div className="rounded-2xl border border-[#FFEA00]/25 bg-[#FFEA00]/10 px-4 py-3 text-sm text-[#FFEA00]">
                Sign in with the Google account that has been marked as admin in Supabase.
              </div>

              {err && (
                <div data-testid="admin-login-error" className="inline-flex items-center gap-2 rounded-xl border border-[#FF007F]/30 bg-[#FF007F]/10 px-3 py-2 text-xs text-[#FF69B4]">
                  <AlertTriangle className="h-3.5 w-3.5" /> {err}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                data-testid="admin-login-submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-[#05050A] disabled:opacity-60"
                style={{ background: "#FFEA00", boxShadow: "0 0 22px rgba(255,234,0,0.35)" }}
              >
                <Lock className="h-4 w-4" /> {busy ? "Opening Google..." : "Continue with Google"}
              </button>
            </div>
          </form>

          <div className="text-center text-xs text-white/40">
            Not an admin? <Link to="/login" className="text-white/70 hover:text-white">Customer sign-in</Link>
            <span className="mx-2">{"\u00b7"}</span>
            <Link to="/technician/login" className="text-[#39FF14] hover:text-white">Technician sign-in</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

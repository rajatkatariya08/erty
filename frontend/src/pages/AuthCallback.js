import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    if (!supabase) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw sessionError || new Error("No Supabase session");
        const { data: userData } = await api.get("/auth/me");
        setUser(userData);
        window.history.replaceState(null, "", window.location.pathname);
        const destination = window.location.pathname.startsWith("/admin")
          ? (userData.user?.is_admin ? "/admin" : "/admin/login")
          : window.location.pathname.startsWith("/technician")
            ? "/technician"
            : "/app";
        navigate(destination, { replace: true, state: { user: userData.user } });
      } catch (e) {
        console.error("Auth callback failed", e);
        navigate("/login", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05050A] text-white">
      <div className="glass rounded-2xl px-8 py-6" data-testid="auth-callback-loading">
        <div className="animate-pulse text-white/80">Signing you in…</div>
      </div>
    </div>
  );
}

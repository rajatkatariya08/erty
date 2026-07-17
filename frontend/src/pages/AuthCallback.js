import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const sessionId = decodeURIComponent(match[1]);

    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        setUser(data.user);
        // clean the hash
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/app", { replace: true, state: { user: data.user } });
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

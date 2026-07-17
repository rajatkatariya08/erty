import { NavLink, Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Home, ClipboardList, ScanLine, User, Shield, Hammer } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Send unauthenticated users to the appropriate login page based on the route they tried to reach
      const path = location.pathname;
      if (path.startsWith("/admin")) navigate("/admin/login", { replace: true });
      else if (path.startsWith("/technician")) navigate("/technician/login", { replace: true });
      else navigate("/login", { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center text-white/70" data-testid="loading">
        Loading…
      </div>
    );
  }
  if (!user) return null;

  const tabs = [
    { to: "/app", label: "Home", icon: Home, testid: "nav-home" },
    { to: "/bookings", label: "Bookings", icon: ClipboardList, testid: "nav-bookings" },
    { to: "/diagnose", label: "AI Diagnose", icon: ScanLine, testid: "nav-diagnose" },
    { to: "/profile", label: "Profile", icon: User, testid: "nav-profile" },
  ];

  return (
    <div className="relative min-h-screen">
      <div className="bg-mesh" />

      {/* Top header */}
      <header className="relative z-20 max-w-3xl mx-auto px-5 sm:px-8 pt-5 flex items-center justify-between">
        <Link to="/" className="font-display font-black text-xl tracking-tight" data-testid="brand">
          ER<span className="neon-text-lime">TY</span>
        </Link>
        <div className="flex items-center gap-2">
          {user.is_technician && (
            <Link
              to="/technician"
              data-testid="nav-technician"
              className="rounded-full glass px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 text-[#39FF14]"
            >
              <Hammer className="h-3.5 w-3.5" /> Tech
            </Link>
          )}
          {user.is_admin && (
            <Link
              to="/admin"
              data-testid="nav-admin"
              className="rounded-full glass px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 text-[#FFEA00]"
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
          <NotificationBell />
        </div>
      </header>

      <main className="relative z-10 pb-28 max-w-3xl mx-auto px-5 sm:px-8 pt-6">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass rounded-full px-2 py-2 flex items-center gap-1 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        data-testid="bottom-nav"
      >
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === "/"}
            data-testid={t.testid}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-[#39FF14] text-[#05050A] shadow-[0_0_20px_rgba(57,255,20,0.4)]"
                  : "text-white/70 hover:text-white"
              }`
            }
          >
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

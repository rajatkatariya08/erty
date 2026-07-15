import { useEffect, useState, useRef } from "react";
import { Bell, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  const load = () => api.get("/notifications").then(r => setItems(r.data)).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter(i => !i.read).length;

  const markAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        data-testid="notification-bell"
        className="relative rounded-full glass h-11 w-11 inline-flex items-center justify-center hover:border-white/20"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-white/80" />
        {unread > 0 && (
          <span
            data-testid="notification-count"
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#FF007F] text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_12px_rgba(255,0,127,0.6)]"
          >
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            data-testid="notification-panel"
            className="absolute right-0 top-14 w-80 max-w-[calc(100vw-2rem)] glass rounded-2xl overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.6)] z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-display font-bold">Notifications</div>
              {unread > 0 && (
                <button
                  onClick={markAll}
                  data-testid="mark-all-read"
                  className="text-xs text-[#00E5FF] hover:text-white inline-flex items-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-white/50 text-sm">No notifications yet</div>
              )}
              {items.map(n => (
                <div
                  key={n.notif_id}
                  className={`px-4 py-3 border-b border-white/5 ${!n.read ? "bg-white/[0.03]" : ""}`}
                  data-testid={`notif-${n.notif_id}`}
                >
                  <div className="flex items-start gap-3">
                    {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.7)]" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{n.title}</div>
                      <div className="text-xs text-white/60 mt-0.5">{n.body}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

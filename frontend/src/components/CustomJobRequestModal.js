import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Send } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function CustomJobRequestModal({ open, onClose, presetHint }) {
  const [description, setDescription] = useState(presetHint || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (description.trim().length < 8) { toast.error("Please describe the job in a few words"); return; }
    if (phone.trim().length < 6) { toast.error("Phone number required"); return; }
    setBusy(true);
    try {
      await api.post("/custom-jobs", {
        description: description.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      toast.success("Sent! Our team will reach out within a few hours.");
      onClose();
      setDescription(""); setPhone(""); setAddress("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 pb-[max(env(safe-area-inset-bottom),1rem)]"
          onClick={onClose}
          data-testid="custom-job-modal"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="w-full max-w-md card-fix p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="blob" style={{ background: "#FF007F", top: -60, right: -30 }} />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#FF007F]">Custom Request</div>
                <div className="font-display text-2xl font-black mt-1">Describe your job</div>
              </div>
              <button onClick={onClose} className="text-white/50 hover:text-white" data-testid="custom-job-close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-white/50 block mb-1">What do you need?</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="e.g. Move a wardrobe from one room to another, or fix a leaking pipe under the sink…"
                  data-testid="custom-job-description"
                  className="w-full rounded-2xl bg-[#0B0B10] border border-white/10 p-3 text-sm placeholder:text-white/25 focus:border-[#FF007F] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-white/50 block mb-1">Phone number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98xxxxxxxx"
                  data-testid="custom-job-phone"
                  className="w-full rounded-2xl bg-[#0B0B10] border border-white/10 p-3 text-sm placeholder:text-white/25 focus:border-[#FF007F] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-white/50 block mb-1">Address (optional)</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Sector 29, Gurugram…"
                  data-testid="custom-job-address"
                  className="w-full rounded-2xl bg-[#0B0B10] border border-white/10 p-3 text-sm placeholder:text-white/25 focus:border-[#FF007F] focus:outline-none"
                />
              </div>

              <div className="rounded-2xl bg-[#FFEA00]/8 border border-[#FFEA00]/25 px-3 py-2 text-[11px] text-[#FFEA00]">
                Status flow · Pending manpower approval → Admin reviews → Team reaches out.
              </div>

              <button
                onClick={submit}
                disabled={busy}
                data-testid="custom-job-submit"
                className="btn-neon-pink rounded-full w-full py-3.5 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> {busy ? "Submitting…" : "Send request"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function CustomJobTile({ onOpen, testid = "custom-job-tile" }) {
  return (
    <button
      onClick={onOpen}
      data-testid={testid}
      className="card-fix p-5 text-left hover:border-[#FF007F]/50 transition-colors relative overflow-hidden group"
      style={{ borderStyle: "dashed" }}
    >
      <div className="blob" style={{ background: "#FF007F", top: -40, right: -30, opacity: 0.35 }} />
      <div className="relative">
        <div className="h-10 w-10 rounded-2xl bg-[#FF007F]/15 flex items-center justify-center text-[#FF007F]">
          <Plus className="h-5 w-5" />
        </div>
        <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[#FF007F]">Custom</div>
        <div className="mt-1 font-display text-base font-bold">Can't find your job?</div>
        <div className="mt-0.5 text-xs text-white/50">Request custom service →</div>
      </div>
    </button>
  );
}

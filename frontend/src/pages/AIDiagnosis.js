import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ScanLine, Sparkles, CircleCheck, ArrowLeft, RefreshCw, ArrowRight, Radio, Send, Languages } from "lucide-react";
import { api, API } from "../lib/api";
import { isSupabaseConfigured } from "../lib/supabase";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "home_appliances", label: "Home Appliance", color: "#FF007F" },
  { id: "handyman", label: "Handyman", color: "#39FF14" },
  { id: "car_and_bike", label: "Car & Bike", color: "#00E5FF" },
];

const CAPTIONS = [
  "Point your camera at the issue",
  "Make sure it's well lit",
  "Include the label or model tag if visible",
  "I'll analyze it in seconds",
];

const LANGUAGES = [
  { code: "English",   label: "English" },
  { code: "Hindi",     label: "हिन्दी" },
  { code: "Spanish",   label: "Español" },
  { code: "French",    label: "Français" },
  { code: "German",    label: "Deutsch" },
  { code: "Portuguese",label: "Português" },
  { code: "Arabic",    label: "العربية" },
  { code: "Chinese",   label: "中文" },
  { code: "Japanese",  label: "日本語" },
  { code: "Tamil",     label: "தமிழ்" },
];

const MAX_IMAGE_EDGE = 1280;
const DIAGNOSIS_IMAGE_QUALITY = 0.72;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function resizeImageDataUrl(src) {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", DIAGNOSIS_IMAGE_QUALITY);
}

export default function AIDiagnosis() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const preCat = sp.get("category");
  const [category, setCategory] = useState(preCat || "home_appliances");
  const [step, setStep] = useState(preCat ? "camera" : "category"); // category | camera | analyzing | result
  const [note, setNote] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [captionIdx, setCaptionIdx] = useState(0);
  const [diagnosis, setDiagnosis] = useState(null);
  const [service, setService] = useState(null); // suggested service to book
  const [language, setLanguage] = useState("English");

  // Live streaming chat state
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveInput, setLiveInput] = useState("");
  const [liveStreaming, setLiveStreaming] = useState(false);
  const liveAbortRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // rotate captions when camera is on
  useEffect(() => {
    if (step !== "camera") return;
    const t = setInterval(() => setCaptionIdx(i => (i + 1) % CAPTIONS.length), 2500);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (step !== "camera") return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        toast.error("Camera unavailable — you can still upload a photo");
      }
    })();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [step]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 960;
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", DIAGNOSIS_IMAGE_QUALITY);
    setSnapshot(dataUrl);
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resized = await resizeImageDataUrl(reader.result);
        setSnapshot(resized);
      } catch {
        toast.error("Could not read that photo. Please try another image.");
      }
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!snapshot) return;
    setStep("analyzing");
    try {
      const { data } = await api.post("/diagnosis", {
        category,
        image_base64: snapshot,
        user_note: note,
        language,
      });
      setDiagnosis(data);
      // suggest a service in this category
      if (data.recommended_service_id) {
        const svcRes = await api.get(`/services/${data.recommended_service_id}`);
        setService(svcRes.data);
      } else {
        const svcRes = await api.get(`/services?category=${category}`);
        if (svcRes.data?.length) setService(svcRes.data[0]);
      }
      setStep("result");
    } catch (e) {
      toast.error(e.response?.data?.detail || "AI analysis failed");
      setStep("camera");
    }
  };

  // ---- Live streaming (Gemini stream_message SSE) ----
  const startLiveStream = async (message) => {
    // Grab a fresh frame from video (or reuse snapshot)
    let frame = snapshot;
    if (!frame && videoRef.current) {
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.videoWidth) {
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext("2d").drawImage(v, 0, 0);
        frame = c.toDataURL("image/jpeg", 0.75);
      }
    }
    if (!frame) { toast.error("Take a photo first"); return; }

    setLiveOpen(true);
    setLiveStreaming(true);
    setLiveTranscript(prev => prev + (prev ? "\n\n" : "") + `You: ${message || "(scan)"}\n\nAI: `);

    if (isSupabaseConfigured) {
      try {
        const { data } = await api.post("/diagnosis", {
          category,
          image_base64: frame,
          user_note: message || "Scan this photo and guide me.",
          language,
        });
        const aiText = [
          data.issue_summary,
          ...(data.detected_problems || []),
          data.ai_notes,
        ].filter(Boolean).join("\n");
        for (const word of aiText.split(" ")) {
          await new Promise(resolve => setTimeout(resolve, 25));
          setLiveTranscript(prev => prev + word + " ");
        }
      } catch (e) {
        setLiveTranscript(prev => prev + `\n[${e.response?.data?.detail || "AI chat failed"}]`);
      }
      setLiveStreaming(false);
      return;
    }

    const controller = new AbortController();
    liveAbortRef.current = controller;

    try {
      const res = await fetch(`${API}/diagnosis/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, image_base64: frame, message: message || "", language }),
        signal: controller.signal,
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const chunk of parts) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.token) {
              setLiveTranscript(prev => prev + payload.token);
            } else if (payload.done) {
              setLiveStreaming(false);
            } else if (payload.error) {
              setLiveTranscript(prev => prev + `\n[error: ${payload.error}]`);
              setLiveStreaming(false);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setLiveTranscript(prev => prev + `\n[stream failed]`);
      }
    } finally {
      setLiveStreaming(false);
      liveAbortRef.current = null;
    }
  };

  const sendLive = () => {
    if (liveStreaming) return;
    const m = liveInput.trim();
    setLiveInput("");
    startLiveStream(m);
  };

  // ---------- CATEGORY STEP ----------
  if (step === "category") {
    return (
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#00E5FF]">
            <Sparkles className="h-3.5 w-3.5" /> AI Diagnosis
          </div>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-black tracking-tight">
            What are we<br /><span className="neon-text-blue">diagnosing?</span>
          </h1>
          <p className="mt-2 text-sm text-white/60 max-w-md">Pick a category so our AI knows what to look for.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => { setCategory(c.id); setStep("camera"); }}
              data-testid={`diag-cat-${c.id}`}
              className="card-fix p-5 text-left hover:border-white/20"
            >
              <div className="blob" style={{ background: c.color, top: -50, right: -30 }} />
              <div className="relative">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Category</div>
                <div className="mt-1 font-display text-xl font-bold" style={{ color: c.color }}>{c.label}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- CAMERA STEP ----------
  if (step === "camera") {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep("category")} className="inline-flex items-center gap-2 text-sm text-white/60" data-testid="back-cat">
          <ArrowLeft className="h-4 w-4" /> Change category
        </button>

        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-black aspect-[3/4]">
          {!snapshot ? (
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" data-testid="camera-video" />
          ) : (
            <img src={snapshot} alt="snap" className="h-full w-full object-cover" data-testid="snapshot-preview" />
          )}

          {/* Floating AI avatar */}
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 3.5 }}
            className="absolute top-4 right-4 glass rounded-full h-14 w-14 flex items-center justify-center shadow-[0_0_24px_rgba(0,229,255,0.35)]"
          >
            <ScanLine className="h-6 w-6 text-[#00E5FF]" />
          </motion.div>

          {/* Live captions */}
          <div className="absolute top-4 left-4 right-24 glass rounded-2xl px-4 py-2.5" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={captionIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-white"
                data-testid="ai-caption"
              >
                <span className="status-dot inline-block mr-2 align-middle" /> {CAPTIONS[captionIdx]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-3">
            {snapshot ? (
              <>
                <button
                  onClick={() => setSnapshot(null)}
                  className="rounded-full glass px-5 py-3 text-sm inline-flex items-center gap-2 text-white"
                  data-testid="retake-btn"
                >
                  <RefreshCw className="h-4 w-4" /> Retake
                </button>
              </>
            ) : (
              <button
                onClick={capture}
                data-testid="capture-btn"
                className="btn-neon-blue rounded-full h-16 w-16 inline-flex items-center justify-center"
              >
                <Camera className="h-7 w-7" />
              </button>
            )}
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <label className="glass rounded-2xl px-4 py-3 text-sm text-white/70 flex items-center justify-between cursor-pointer" data-testid="upload-label">
          <span>Or upload a photo</span>
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" data-testid="file-input" />
          <span className="text-[#00E5FF] font-semibold">Choose</span>
        </label>

        <textarea
          data-testid="user-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Tell the AI what's happening (optional)"
          className="w-full rounded-2xl bg-[#121217] border border-white/10 p-4 text-sm text-white placeholder:text-white/30 focus:border-[#00E5FF] focus:outline-none"
        />

        {/* Language selector */}
        <div>
          <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
            <Languages className="h-4 w-4 text-[#FFEA00]" /> AI response language
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                data-testid={`lang-${l.code.toLowerCase()}`}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  language === l.code
                    ? "bg-[#FFEA00] text-[#05050A] shadow-[0_0_16px_rgba(255,234,0,0.4)]"
                    : "glass text-white/70"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={analyze}
          disabled={!snapshot}
          data-testid="analyze-btn"
          className="btn-neon-lime rounded-full px-8 py-4 font-semibold text-base w-full disabled:opacity-40"
        >
          Analyze with AI
        </button>

        <button
          onClick={() => startLiveStream("What do you see? Guide me.")}
          disabled={!snapshot && !videoRef.current}
          data-testid="live-chat-btn"
          className="rounded-full glass px-6 py-3.5 font-semibold text-sm w-full inline-flex items-center justify-center gap-2 text-white"
        >
          <Radio className="h-4 w-4 text-[#00E5FF]" /> Live AI Chat (streaming)
        </button>

        {/* Live streaming panel */}
        <AnimatePresence>
          {liveOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="card-fix p-5 space-y-3"
              data-testid="live-panel"
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#00E5FF]">
                  <Radio className="h-3.5 w-3.5" /> Live · Gemini stream
                </div>
                <button
                  onClick={() => { liveAbortRef.current?.abort(); setLiveOpen(false); setLiveTranscript(""); }}
                  className="text-xs text-white/50 hover:text-white"
                  data-testid="close-live-btn"
                >
                  Close
                </button>
              </div>
              <div
                data-testid="live-transcript"
                className="rounded-2xl bg-[#0B0B10] border border-white/5 p-3 text-sm text-white/85 whitespace-pre-wrap min-h-[80px] max-h-56 overflow-y-auto font-mono"
              >
                {liveTranscript}
                {liveStreaming && <span className="inline-block ml-1 h-3 w-1 bg-[#39FF14] align-middle animate-pulse" />}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={liveInput}
                  onChange={(e) => setLiveInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendLive()}
                  placeholder="Ask a follow-up (or leave blank to re-scan)"
                  disabled={liveStreaming}
                  data-testid="live-input"
                  className="flex-1 rounded-full bg-[#0B0B10] border border-white/10 px-4 py-2.5 text-sm focus:border-[#00E5FF] focus:outline-none disabled:opacity-60"
                />
                <button
                  onClick={sendLive}
                  disabled={liveStreaming}
                  data-testid="live-send-btn"
                  className="btn-neon-blue rounded-full h-10 w-10 inline-flex items-center justify-center disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">
                Tip: retake a fresh photo above, then send another message to stream a new response.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ---------- ANALYZING STEP ----------
  if (step === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
          className="h-24 w-24 rounded-full border-4 border-white/10 border-t-[#39FF14] border-r-[#00E5FF]"
        />
        <div className="text-center">
          <div className="font-display text-2xl font-bold">Diagnosing…</div>
          <div className="text-white/60 text-sm mt-1">Gemini is inspecting your photo</div>
        </div>
      </div>
    );
  }

  // ---------- RESULT STEP ----------
  return (
    <div className="space-y-5">
      {diagnosis?.test_mode && (
        <div
          data-testid="test-mode-banner"
          className="rounded-2xl border border-[#FFEA00]/40 bg-[#FFEA00]/10 px-4 py-3 text-xs text-[#FFEA00]"
        >
          <b className="uppercase tracking-widest">Test mode</b> · AI is disconnected right now — this is a sample diagnosis. Real Gemini analysis will resume once the Google key is wired up.
        </div>
      )}
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#39FF14]">
        <CircleCheck className="h-3.5 w-3.5" /> Diagnosis Ready
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight" data-testid="diag-headline">
        {diagnosis?.issue_summary}
      </h1>

      <div className="card-fix p-6">
        <div className="blob" style={{ background: "#39FF14", top: -60, right: -30 }} />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Estimated cost</div>
          <div className="mt-2 font-display text-4xl font-black neon-text-lime" data-testid="cost-estimate">
            ₹{diagnosis?.estimated_cost_min} – ₹{diagnosis?.estimated_cost_max}
          </div>
          <div className="mt-2 text-xs text-white/50">
            Severity: <span className="uppercase text-white/80 tracking-widest">{diagnosis?.severity}</span>
          </div>
        </div>
      </div>

      <div className="card-fix p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Detected problems</div>
        <ul className="space-y-2">
          {diagnosis?.detected_problems?.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/85">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#FF007F]" /> {p}
            </li>
          ))}
        </ul>
        {diagnosis?.ai_notes && (
          <div className="mt-4 rounded-2xl bg-[#0B0B10] border border-white/5 p-4 text-sm text-white/70">
            {diagnosis.ai_notes}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {service ? (
          <Link
            to={`/book/${service.service_id}?tier=${encodeURIComponent(service.tiers[0].name)}&diagnosis_id=${diagnosis.diagnosis_id}`}
            data-testid="book-technician-btn"
            className="btn-neon-lime rounded-full px-6 py-4 font-semibold text-sm inline-flex items-center justify-center gap-2 flex-1"
          >
            Book Technician <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            onClick={() => navigate("/")}
            className="btn-neon-lime rounded-full px-6 py-4 font-semibold text-sm flex-1"
          >
            Browse services
          </button>
        )}
        <button
          onClick={() => { setDiagnosis(null); setSnapshot(null); setStep("camera"); }}
          className="rounded-full glass px-6 py-4 font-semibold text-sm text-white"
          data-testid="new-diagnosis-btn"
        >
          New diagnosis
        </button>
      </div>
    </div>
  );
}

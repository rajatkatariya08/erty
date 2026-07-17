import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Bike, BookOpenText, Camera,
  ChevronRight, ClipboardCheck, ExternalLink, HelpCircle, MapPin, PackageSearch,
  Play, ShieldCheck, Sparkles, UserCheck, WalletCards, WashingMachine, Wrench,
} from "lucide-react";

const SERVICE_GROUPS = [
  {
    title: "Home appliance repair",
    slug: "appliance-repair-gurugram",
    description: "AC, refrigerator, washing machine, microwave, geyser, RO, TV, chimney, and dishwasher support.",
    Icon: WashingMachine,
    color: "#FF007F",
  },
  {
    title: "Handyman and installation",
    slug: "handyman-services-gurugram",
    description: "Electrical, plumbing, drilling, fittings, furniture assembly, TV mounting, and odd jobs.",
    Icon: Wrench,
    color: "#39FF14",
  },
  {
    title: "Car and bike support",
    slug: "car-bike-repair-gurugram",
    description: "Doorstep inspection, battery help, minor fixes, servicing support, and emergency diagnosis.",
    Icon: Bike,
    color: "#00E5FF",
  },
];

const WORK_STEPS = [
  { title: "Snap or choose a service", body: "Start with AI Lens or directly pick the repair you need.", Icon: Camera },
  { title: "Understand the estimate", body: "See likely issues, severity, visit cost, and possible replacement parts.", Icon: ClipboardCheck },
  { title: "Book a verified technician", body: "Choose a slot and let ERTY route the job to the right service flow.", Icon: UserCheck },
  { title: "Pay after service", body: "Get the work done first, then review the visit and complete payment.", Icon: WalletCards },
];

const FEATURES = [
  "Photo-based AI diagnosis",
  "Part price awareness",
  "Verified technician review",
  "Booking and status tracking",
  "Admin-controlled service catalog",
  "Gurugram-first local coverage",
];

const FAQS = [
  ["What is ERTY?", "ERTY is a doorstep repair and rapid task platform for home appliances, handyman work, and vehicle support."],
  ["Is AI Lens a live video call?", "Not yet. AI Lens currently works from photos and AI chat. It is designed to explain the likely issue before booking."],
  ["Does ERTY sell spare parts?", "No. ERTY shows market part estimates only to help customers understand possible expenses and avoid unfair quotes."],
  ["Are estimates final?", "No. Estimates help customers prepare. The final repair need and price must be confirmed after technician inspection."],
  ["Where is ERTY available?", "ERTY is starting with focused coverage in Gurugram so response time and service quality can stay reliable."],
];

const BLOGS = [
  "AC not cooling? Common reasons before calling a technician",
  "How to read your appliance model number",
  "Fridge not cooling: simple checks and likely repair range",
  "Washing machine noise: what the sound usually means",
  "How AI diagnosis helps before booking a repair",
  "Why spare part market prices matter for customers",
];

const SERVICE_PAGES = {
  "ac-repair-gurugram": {
    title: "AC repair in Gurugram",
    description: "Book AC inspection, cooling issue diagnosis, servicing, water leakage checks, and repair support in Gurugram.",
    includes: ["AC not cooling", "Water leakage", "Unusual noise", "Servicing and cleaning", "Possible gas or compressor issue"],
  },
  "washing-machine-repair-gurugram": {
    title: "Washing machine repair in Gurugram",
    description: "Get help for washing machine noise, drainage issues, spinning problems, vibration, and error symptoms.",
    includes: ["Drainage issue", "Spin problem", "Noise and vibration", "Door lock issue", "Motor or belt inspection"],
  },
  "refrigerator-repair-gurugram": {
    title: "Refrigerator repair in Gurugram",
    description: "Book fridge diagnosis for cooling problems, water leakage, compressor concerns, thermostat issues, and unusual sounds.",
    includes: ["Not cooling", "Ice build-up", "Water leakage", "Compressor check", "Thermostat issue"],
  },
  "geyser-repair-gurugram": {
    title: "Geyser repair in Gurugram",
    description: "Book geyser repair support for no heating, leakage, wiring, installation, and safety inspection.",
    includes: ["No heating", "Leakage", "Installation", "Wiring check", "Safety inspection"],
  },
  "ro-repair-gurugram": {
    title: "RO repair in Gurugram",
    description: "Book RO service for low water flow, filter change guidance, leakage, taste issues, and routine maintenance.",
    includes: ["Low water flow", "Filter issue", "Leakage", "Taste or smell issue", "Routine service"],
  },
};

function setSeo(title, description) {
  document.title = title;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", description);
}

function MarketingShell({ title, description, children }) {
  useEffect(() => setSeo(title, description), [title, description]);
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05050A] text-white">
      <div className="bg-mesh" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="font-display text-2xl font-black tracking-tight">
          ER<span className="neon-text-lime">TY</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-white/65 sm:flex">
          <Link to="/services" className="hover:text-white">Services</Link>
          <Link to="/ai-diagnosis" className="hover:text-white">AI Lens</Link>
          <Link to="/pricing" className="hover:text-white">Pricing</Link>
          <Link to="/blog" className="hover:text-white">Blog</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-full glass px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">Sign in</Link>
          <Link to="/login" className="btn-neon-lime hidden rounded-full px-4 py-2 text-sm font-bold sm:inline-flex">Book now</Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8">{children}</main>
      <footer className="relative z-10 border-t border-white/10 bg-[#07070D]/80">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          <div>
            <Link to="/" className="font-display text-3xl font-black tracking-tight">
              ER<span className="neon-text-lime">TY</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/55">
              Rapid doorstep help with clearer estimates, AI Lens guidance, and verified technician workflows in Gurugram.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55"><Play className="h-3.5 w-3.5 fill-current" /> Google Play · Coming soon</span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55"><span className="text-sm"></span> App Store · Coming soon</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/40">Explore</div>
            <div className="mt-4 grid gap-3 text-sm text-white/65">
              <Link to="/services" className="hover:text-white">Services</Link>
              <Link to="/ai-diagnosis" className="hover:text-white">AI Lens</Link>
              <Link to="/pricing" className="hover:text-white">Pricing</Link>
              <Link to="/blog" className="hover:text-white">Repair guides</Link>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/40">Company</div>
            <div className="mt-4 grid gap-3 text-sm text-white/65">
              <Link to="/about" className="hover:text-white">About ERTY</Link>
              <Link to="/login" className="hover:text-white">Customer sign in</Link>
              <Link to="/technician/signup" className="hover:text-white">Become a technician</Link>
              <a href="https://hoardigo.com/portal.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">Become a media partner <ExternalLink className="h-3 w-3" /></a>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/40">Get in touch</div>
            <div className="mt-4 space-y-3 text-sm text-white/65">
              <a href="mailto:support@erty.in" className="block hover:text-white">support@erty.in</a>
              <p>ERTY Services Pvt Ltd<br />DLF Phase 1, Sector 27<br />Gurugram 122022</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>© {new Date().getFullYear()} ERTY Services Pvt Ltd. All rights reserved.</span>
            <span>Built for clearer local repair decisions.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Pill({ children }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/65">{children}</span>;
}

function SectionTitle({ kicker, title, body }) {
  return (
    <div className="mb-6">
      <div className="text-xs uppercase tracking-[0.28em] text-white/45">{kicker}</div>
      <h2 className="mt-2 font-display text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 max-w-2xl text-base leading-7 text-white/60">{body}</p>}
    </div>
  );
}

function HomePreviewCard() {
  return (
    <div className="card-fix min-h-[430px] p-5 shadow-[0_0_60px_rgba(0,229,255,0.16)]">
      <div className="blob" style={{ background: "#00E5FF", top: -60, right: -30 }} />
      <div className="blob" style={{ background: "#FF007F", bottom: -60, left: -40 }} />
      <div className="relative">
        <div className="mb-4 flex flex-wrap gap-2">
          {['Photo diagnosis', 'AI-powered estimates', 'Part price awareness'].map((label) => <span key={label} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/55">{label}</span>)}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-xs text-white/75">
          <span className="status-dot" /> AI Lens ready
        </div>
        <div className="mt-6 rounded-[28px] border border-white/10 bg-black/45 p-4">
          <div className="aspect-[4/5] rounded-[22px] border border-white/10 bg-gradient-to-br from-[#2b2b31] via-[#15151c] to-[#071e21] p-5">
            <div className="rounded-2xl bg-black/45 px-4 py-3 text-sm text-white/80">Point your camera at the issue</div>
            <div className="mt-28 text-center">
              <ScanIcon />
              <div className="mt-5 font-display text-2xl font-black">Snap. Diagnose. Book.</div>
              <p className="mx-auto mt-2 max-w-xs text-sm text-white/55">Understand likely problems and market part estimates before booking.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.05] p-4">
            <div className="text-xs text-white/45">Estimate</div>
            <div className="mt-1 font-display text-xl font-black text-[#39FF14]">INR 799-1,999</div>
          </div>
          <div className="rounded-2xl bg-white/[0.05] p-4">
            <div className="text-xs text-white/45">Parts</div>
            <div className="mt-1 font-display text-xl font-black text-[#00E5FF]">Market aware</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScanIcon() {
  return (
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#39FF14] text-[#05050A] shadow-[0_0_32px_rgba(57,255,20,0.5)]">
      <Sparkles className="h-9 w-9" />
    </div>
  );
}

export function MarketingHome() {
  return (
    <MarketingShell
      title="ERTY - Doorstep repair, AI diagnosis and technician booking in Gurugram"
      description="ERTY helps Gurugram customers diagnose home repair issues with AI Lens and book verified technicians for appliances, handyman jobs, car and bike support."
    >
      <section className="grid min-h-[calc(100vh-92px)] items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70">
            <Sparkles className="h-4 w-4 text-[#39FF14]" /> Executing Rapid Tasks For You
          </div>
          <h1 className="mt-6 font-display text-5xl font-black leading-[0.94] tracking-tight sm:text-7xl">
            Rapid repairs,<br />
            <span className="neon-text-lime">booked in minutes.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
            ERTY helps you diagnose appliance, vehicle, and home repair problems with AI, then book a verified technician at your doorstep.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className="btn-neon-lime inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full px-7 text-sm font-bold">
              Start AI Diagnosis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/services" className="inline-flex min-h-[54px] items-center justify-center rounded-full glass px-7 text-sm font-semibold text-white">
              Browse services
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            <Pill>Serving Gurugram</Pill>
            <Pill>Verified technicians</Pill>
            <Pill>AI-powered estimates</Pill>
            <Pill>Part price awareness</Pill>
          </div>
        </div>
        <HomePreviewCard />
      </section>

      <section className="py-12">
        <SectionTitle kicker="How it works" title="From confusion to booked repair" body="ERTY gives customers a clearer path before the technician arrives." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WORK_STEPS.map(({ title, body, Icon }, index) => (
            <div key={title} className="card-fix p-5">
              <div className="relative">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-[#39FF14]"><Icon className="h-5 w-5" /></div>
                  <div className="font-display text-3xl font-black text-white/10">0{index + 1}</div>
                </div>
                <h3 className="font-display text-xl font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionTitle kicker="AI Lens" title="Understand the issue before booking" body="Point your camera at the appliance or repair issue. ERTY's AI gives a plain-language diagnosis, estimated range, and likely replacement parts when model details are available." />
          <Link to="/ai-diagnosis" className="inline-flex items-center gap-2 text-sm font-bold text-[#00E5FF]">Learn about AI Lens <ChevronRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/80">
              <BadgeCheck className="mb-3 h-5 w-5 text-[#39FF14]" /> {feature}
            </div>
          ))}
        </div>
      </section>

      <section className="py-12">
        <SectionTitle kicker="Services" title="Services ERTY handles" body="Start with the most common repair categories today. More local services can be added from the admin panel as operations grow." />
        <div className="grid gap-4 lg:grid-cols-3">
          {SERVICE_GROUPS.map(({ title, description, slug, Icon, color }) => (
            <Link key={title} to={`/services/${slug}`} className="card-fix p-6 transition-colors hover:border-white/25">
              <div className="blob" style={{ background: color, top: -80, right: -60 }} />
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06]" style={{ color }}><Icon className="h-6 w-6" /></div>
                <h3 className="mt-5 font-display text-2xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/58">{description}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold" style={{ color }}>View services <ArrowRight className="h-4 w-4" /></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 py-12 lg:grid-cols-3">
        <div className="card-fix p-6 lg:col-span-2">
          <div className="relative">
            <PackageSearch className="h-8 w-8 text-[#FFEA00]" />
            <h2 className="mt-4 font-display text-3xl font-black">Spare part price awareness, not spare part selling.</h2>
            <p className="mt-3 text-base leading-7 text-white/60">
              ERTY does not sell parts. AI Lens can show rough market ranges for likely replacement parts so customers understand possible expenses and no one can make the repair feel mysterious.
            </p>
          </div>
        </div>
        <div className="card-fix p-6">
          <ShieldCheck className="h-8 w-8 text-[#39FF14]" />
          <h3 className="mt-4 font-display text-2xl font-black">Built for trust</h3>
          <p className="mt-3 text-sm leading-6 text-white/58">Technicians are reviewed by admin, bookings are tracked, and customers see clearer information before choosing a service.</p>
        </div>
      </section>

      <section className="py-12">
        <SectionTitle kicker="Questions" title="Clear answers before booking" />
        <div className="grid gap-3 lg:grid-cols-2">
          {FAQS.map(([question, answer]) => (
            <div key={question} className="card-fix p-5">
              <div className="relative">
                <HelpCircle className="mb-3 h-5 w-5 text-[#00E5FF]" />
                <h3 className="font-bold">{question}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">{answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}

export function ServicesLanding() {
  return (
    <MarketingShell title="ERTY services in Gurugram - Appliance, handyman, car and bike repair" description="Browse ERTY service categories for home appliance repair, handyman jobs, installations, car and bike support in Gurugram.">
      <section className="py-16">
        <SectionTitle kicker="Services" title="Doorstep repair services in Gurugram" body="Each service page should answer what can be fixed, what customers should check first, and how booking works." />
        <div className="grid gap-4 lg:grid-cols-3">
          {SERVICE_GROUPS.map(({ title, description, slug, Icon, color }) => (
            <Link key={slug} to={`/services/${slug}`} className="card-fix p-6">
              <div className="relative">
                <Icon className="h-8 w-8" style={{ color }} />
                <h2 className="mt-4 font-display text-2xl font-black">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/58">{description}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(SERVICE_PAGES).map(([slug, page]) => (
            <Link key={slug} to={`/services/${slug}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/75 hover:text-white">{page.title}</Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}

export function ServiceSeoPage({ slug }) {
  const page = SERVICE_PAGES[slug] || {
    title: "Doorstep repair services in Gurugram",
    description: "Book ERTY technician support for home repair, appliance repair, installations, and vehicle support in Gurugram.",
    includes: ["AI diagnosis", "Technician booking", "Transparent estimates", "Status tracking"],
  };
  return (
    <MarketingShell title={`${page.title} - ERTY`} description={page.description}>
      <section className="grid gap-10 py-16 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70">
            <MapPin className="h-4 w-4 text-[#00E5FF]" /> Gurugram service
          </div>
          <h1 className="mt-6 font-display text-5xl font-black leading-tight">{page.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">{page.description}</p>
          <Link to="/login" className="btn-neon-lime mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-bold">Book technician <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="card-fix p-6">
          <h2 className="font-display text-2xl font-black">Common issues covered</h2>
          <div className="mt-4 space-y-3">
            {page.includes.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 text-sm text-white/75">
                <BadgeCheck className="h-4 w-4 text-[#39FF14]" /> {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

export function AILensInfo() {
  return (
    <MarketingShell title="ERTY AI Lens - Photo diagnosis and part price awareness" description="Learn how ERTY AI Lens analyzes repair photos, explains likely issues, estimates cost ranges, and helps customers understand possible spare part prices.">
      <section className="py-16">
        <SectionTitle kicker="AI Lens" title="Photo diagnosis for everyday repairs" body="AI Lens is not a live video call. It analyzes a photo, lets the customer ask follow-up questions, and can estimate likely replacement parts when model details are available." />
        <div className="grid gap-4 lg:grid-cols-3">
          {["Upload or capture a repair photo", "Get likely issue and severity", "Ask about spare part market ranges"].map((item) => (
            <div key={item} className="card-fix p-6"><Sparkles className="h-6 w-6 text-[#39FF14]" /><h2 className="mt-4 font-display text-xl font-black">{item}</h2></div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}

export function AboutPage() {
  return (
    <MarketingShell title="About ERTY - Rapid repair and task booking in Gurugram" description="ERTY is building a clearer doorstep repair experience with AI diagnosis, verified technician workflows, and transparent customer communication.">
      <section className="py-16">
        <SectionTitle kicker="About" title="A clearer way to book local repair help" body="ERTY is built for customers who want to understand the problem before committing to a technician visit. We combine AI diagnosis, service booking, admin review, and local technician operations." />
      </section>
    </MarketingShell>
  );
}

export function PricingPage() {
  return (
    <MarketingShell title="ERTY pricing - Visit fees, estimates and part price awareness" description="Understand how ERTY shows visit fees, estimated repair ranges, and optional market awareness for likely spare parts.">
      <section className="py-16">
        <SectionTitle kicker="Pricing" title="Transparent estimates before the visit" body="ERTY shows service pricing where available, AI repair ranges for diagnosis, and market part estimates only as guidance. Final price depends on technician inspection." />
      </section>
    </MarketingShell>
  );
}

export function BlogIndex() {
  return (
    <MarketingShell title="ERTY repair guides - Appliance and home repair advice" description="Helpful repair guides from ERTY for appliance problems, home repair checks, model numbers, AI diagnosis, and spare part price awareness.">
      <section className="py-16">
        <SectionTitle kicker="Repair guides" title="Helpful articles customers will search for" body="These blog topics are designed around real customer questions, not keyword stuffing." />
        <div className="grid gap-3 lg:grid-cols-2">
          {BLOGS.map((blog) => (
            <div key={blog} className="card-fix p-5">
              <BookOpenText className="h-5 w-5 text-[#00E5FF]" />
              <h2 className="mt-3 font-display text-xl font-black">{blog}</h2>
              <p className="mt-2 text-sm text-white/55">Draft this as a people-first guide with simple checks, warning signs, and when to book a technician.</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}

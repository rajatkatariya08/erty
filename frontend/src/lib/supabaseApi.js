import { supabase } from "./supabase";

const CITY_CENTER = { lat: 28.4595, lng: 77.0266 };
const CITY_BOUNDS = { lat_min: 28.3, lat_max: 28.6, lng_min: 76.85, lng_max: 77.2 };

function response(data) {
  return { data };
}

function fail(detail, status = 400) {
  const error = new Error(detail);
  error.response = { status, data: { detail } };
  throw error;
}

function ensureSupabase() {
  if (!supabase) fail("Supabase is not configured", 500);
}

function code(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

function parseUrl(url) {
  const [path, queryString = ""] = url.split("?");
  const params = new URLSearchParams(queryString);
  return { path, params };
}

function mapCategory(row) {
  return {
    id: row.category_id,
    label: row.label,
    tagline: row.tagline,
    booking_fee: row.booking_fee,
    coming_soon: row.coming_soon,
    sort_order: row.sort_order,
  };
}

function mapService(row) {
  return {
    service_id: row.id,
    service_code: row.service_code,
    category: row.category,
    name: row.name,
    description: row.description,
    icon: row.icon,
    image_url: row.image_url,
    tiers: Array.isArray(row.tiers) ? row.tiers : [],
    base_price: row.base_price,
    market_min: row.market_min,
    market_max: row.market_max,
    is_flat_visit: row.is_flat_visit,
    booking_fee: row.booking_fee,
    active: row.active,
    created_at: row.created_at,
  };
}

function mapTechnician(row) {
  return {
    tech_id: row.id,
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    picture: row.picture,
    rating: Number(row.rating || 0),
    experience_years: row.experience_years,
    specializations: row.specializations || [],
    phone: row.phone,
    is_available: row.is_available,
    home_lat: Number(row.home_lat),
    home_lng: Number(row.home_lng),
    status: row.status,
    gov_id_thumb: row.gov_id_thumb,
    created_at: row.created_at,
  };
}

function mapBooking(row) {
  return {
    booking_id: row.id,
    booking_code: row.booking_code,
    user_id: row.user_id,
    customer_name: row.customer_name || "",
    customer_email: row.customer_email || "",
    customer_phone: row.customer_phone || "",
    service_id: row.service_id,
    service_name: row.service_name,
    category: row.category,
    tier_name: row.tier_name,
    price: row.price,
    address: row.address,
    scheduled_date: row.scheduled_date,
    scheduled_slot: row.scheduled_slot,
    notes: row.notes,
    status: row.status,
    tech_id: row.technician_id,
    tech_name: row.tech_name,
    tech_picture: row.tech_picture,
    tech_lat: row.tech_lat == null ? null : Number(row.tech_lat),
    tech_lng: row.tech_lng == null ? null : Number(row.tech_lng),
    dest_lat: Number(row.dest_lat),
    dest_lng: Number(row.dest_lng),
    diagnosis_id: row.diagnosis_id,
    rating: row.rating,
    review: row.review,
    created_at: row.created_at,
  };
}

function mapDiagnosis(row) {
  return {
    diagnosis_id: row.id,
    user_id: row.user_id,
    category: row.category,
    issue_summary: row.issue_summary,
    detected_problems: row.detected_problems || [],
    severity: row.severity,
    estimated_cost_min: row.estimated_cost_min,
    estimated_cost_max: row.estimated_cost_max,
    recommended_service: row.recommended_service,
    ai_notes: row.ai_notes,
    image_thumb: row.image_thumb,
    language: row.language,
    test_mode: Boolean(row.test_mode),
    created_at: row.created_at,
  };
}

function mapNotification(row) {
  return {
    notif_id: row.id,
    user_id: row.user_id,
    title: row.title,
    body: row.body,
    booking_id: row.booking_id,
    read: row.read,
    created_at: row.created_at,
  };
}

function mapCustomJob(row) {
  return {
    job_id: row.id,
    user_id: row.user_id,
    user_email: row.user_email,
    user_name: row.user_name,
    description: row.description,
    phone: row.phone,
    preferred_date: row.preferred_date,
    address: row.address,
    status: row.status,
    created_at: row.created_at,
  };
}

async function currentUser() {
  ensureSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) fail("Not authenticated", 401);

  const authUser = userData.user;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) fail(profileError.message, 401);

  const { data: tech } = await supabase
    .from("technicians")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();

  const metadata = authUser.user_metadata || {};
  const role = profile?.role || (tech ? "technician" : "customer");
  return {
    user_id: authUser.id,
    email: profile?.email || authUser.email || "",
    name: profile?.full_name || metadata.full_name || metadata.name || authUser.email?.split("@")[0] || "User",
    picture: profile?.avatar_url || metadata.avatar_url || metadata.picture || "",
    role,
    created_at: profile?.created_at || authUser.created_at,
    is_admin: role === "admin",
    is_technician: role === "technician" || Boolean(tech),
    tech_id: tech?.id || null,
    tech_status: tech?.status || null,
  };
}

async function countRows(table, build = (q) => q) {
  const { count, error } = await build(
    supabase.from(table).select("*", { count: "exact", head: true })
  );
  if (error) fail(error.message);
  return count || 0;
}

async function requireAdmin() {
  const user = await currentUser();
  if (!user.is_admin) fail("Admin access only", 403);
  return user;
}

async function requireTechnician() {
  const user = await currentUser();
  if (!user.is_technician) fail("Technician access only", 403);
  const { data, error } = await supabase
    .from("technicians")
    .select("*")
    .eq("id", user.tech_id)
    .maybeSingle();
  if (error || !data) fail("Technician profile not found", 403);
  return mapTechnician(data);
}

async function createNotification(userId, title, body, bookingId = null) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    body,
    booking_id: bookingId,
    read: false,
  });
}

async function get(pathWithQuery) {
  const { path, params } = parseUrl(pathWithQuery);

  if (path === "/auth/me") return response(await currentUser());

  if (path === "/service-area") {
    return response({
      city: "Gurugram",
      region: "Haryana",
      center: CITY_CENTER,
      bounds: CITY_BOUNDS,
    });
  }

  if (path === "/categories") {
    const { data, error } = await supabase
      .from("service_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) fail(error.message);
    return response((data || []).map(mapCategory));
  }

  if (path === "/services") {
    let query = supabase.from("services").select("*").eq("active", true).order("created_at", { ascending: true });
    const category = params.get("category");
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) fail(error.message);
    return response((data || []).map(mapService));
  }

  if (path.startsWith("/services/")) {
    const id = path.split("/")[2];
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) fail(error.message);
    if (!data) fail("Service not found", 404);
    return response(mapService(data));
  }

  if (path === "/bookings") {
    const user = await currentUser();
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false });
    if (error) fail(error.message);
    return response((data || []).map(mapBooking));
  }

  if (path.startsWith("/bookings/")) {
    const user = await currentUser();
    const id = path.split("/")[2];
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.user_id)
      .maybeSingle();
    if (error) fail(error.message);
    if (!data) fail("Booking not found", 404);
    return response(mapBooking(data));
  }

  if (path === "/diagnosis") {
    const user = await currentUser();
    const { data, error } = await supabase
      .from("diagnoses")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false });
    if (error) fail(error.message);
    return response((data || []).map(mapDiagnosis));
  }

  if (path === "/notifications") {
    const user = await currentUser();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) fail(error.message);
    return response((data || []).map(mapNotification));
  }

  if (path === "/custom-jobs") {
    const user = await currentUser();
    const { data, error } = await supabase
      .from("custom_jobs")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false });
    if (error) fail(error.message);
    return response((data || []).map(mapCustomJob));
  }

  if (path === "/tech/me") {
    const tech = await requireTechnician();
    return response(tech);
  }

  if (path === "/tech/jobs") {
    const tech = await requireTechnician();
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .or(`technician_id.eq.${tech.tech_id},status.eq.unassigned`)
      .order("created_at", { ascending: false });
    if (error) fail(error.message);
    return response((data || []).map(mapBooking));
  }

  if (path === "/admin/stats") {
    await requireAdmin();
    const [
      services,
      technicians,
      techniciansPending,
      bookings,
      bookingsUnassigned,
      diagnoses,
      users,
    ] = await Promise.all([
      countRows("services"),
      countRows("technicians"),
      countRows("technicians", (q) => q.eq("status", "pending")),
      countRows("bookings"),
      countRows("bookings", (q) => q.eq("status", "unassigned")),
      countRows("diagnoses"),
      countRows("profiles"),
    ]);
    return response({ services, technicians, technicians_pending: techniciansPending, bookings, bookings_unassigned: bookingsUnassigned, diagnoses, users });
  }

  if (path === "/admin/services") {
    await requireAdmin();
    const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: false });
    if (error) fail(error.message);
    return response((data || []).map(mapService));
  }

  if (path === "/admin/technicians" || path === "/admin/technicians/pending") {
    await requireAdmin();
    let query = supabase.from("technicians").select("*").order("created_at", { ascending: false });
    if (path.endsWith("/pending")) query = query.eq("status", "pending");
    const { data, error } = await query;
    if (error) fail(error.message);
    return response((data || []).map(mapTechnician));
  }

  if (path === "/admin/bookings") {
    await requireAdmin();
    const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
    if (error) fail(error.message);
    return response((data || []).map(mapBooking));
  }

  if (path === "/admin/custom-jobs") {
    await requireAdmin();
    const { data, error } = await supabase.from("custom_jobs").select("*").order("created_at", { ascending: false });
    if (error) fail(error.message);
    return response((data || []).map(mapCustomJob));
  }

  if (path === "/admin/outbound") return response([]);

  fail(`Unknown Supabase route: ${path}`, 404);
}

async function post(path, payload = {}) {
  if (path === "/auth/google") {
    if (payload.credential) {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: payload.credential,
      });
      if (error) fail(error.message, 401);
      return response({ ok: true });
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: payload.redirectTo || window.location.origin },
    });
    if (error) fail(error.message, 401);
    return response({ ok: true });
  }

  if (path === "/auth/logout") {
    await supabase.auth.signOut();
    return response({ ok: true });
  }

  if (path === "/auth/session") {
    return response({ user: await currentUser() });
  }

  if (path === "/auth/admin/login" || path === "/auth/tech/login") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${path === "/auth/admin/login" ? "/admin/login" : "/technician/login"}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) fail(error.message, 401);
    return response({ ok: true });
  }

  if (path === "/auth/tech/signup") {
    const user = await currentUser();
    if (payload.home_lat < CITY_BOUNDS.lat_min || payload.home_lat > CITY_BOUNDS.lat_max ||
        payload.home_lng < CITY_BOUNDS.lng_min || payload.home_lng > CITY_BOUNDS.lng_max) {
      fail("Base location must be within Gurugram, Haryana");
    }
    const doc = {
      user_id: user.user_id,
      name: payload.name,
      email: payload.email || user.email,
      phone: payload.phone,
      specializations: payload.specializations || [],
      gov_id_thumb: (payload.gov_id_base64 || "").slice(0, 12000),
      home_lat: payload.home_lat,
      home_lng: payload.home_lng,
      experience_years: payload.experience_years || 0,
      picture: user.picture || "",
      status: "pending",
      is_available: false,
    };
    const { data, error } = await supabase.from("technicians").insert(doc).select("*").single();
    if (error) fail(error.message);
    return response({ ok: true, status: "pending", tech: mapTechnician(data) });
  }

  if (path === "/bookings") {
    const user = await currentUser();
    const { data: svc, error: svcError } = await supabase
      .from("services")
      .select("*")
      .eq("id", payload.service_id)
      .maybeSingle();
    if (svcError) fail(svcError.message);
    if (!svc) fail("Service not found", 404);
    const tier = (svc.tiers || []).find((item) => item.name === payload.tier_name);
    if (!tier) fail("Invalid tier");
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        booking_code: code("bk"),
        user_id: user.user_id,
        customer_name: user.full_name || user.email || "Customer",
        customer_email: user.email || "",
        customer_phone: payload.customer_phone,
        service_id: svc.id,
        service_name: svc.name,
        category: svc.category,
        tier_name: tier.name,
        price: tier.price,
        address: payload.address,
        scheduled_date: payload.scheduled_date,
        scheduled_slot: payload.scheduled_slot,
        notes: payload.notes || "",
        status: "unassigned",
        dest_lat: payload.dest_lat || CITY_CENTER.lat,
        dest_lng: payload.dest_lng || CITY_CENTER.lng,
        diagnosis_id: payload.diagnosis_id || null,
      })
      .select("*")
      .single();
    if (error) fail(error.message);
    await createNotification(user.user_id, "Booking received", `${svc.name} on ${payload.scheduled_date}. Our team will assign a technician shortly.`, data.id);
    return response(mapBooking(data));
  }

  if (path.match(/^\/bookings\/[^/]+\/simulate-tech$/)) {
    const id = path.split("/")[2];
    const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
    if (error) fail(error.message);
    if (!booking) fail("Booking not found", 404);
    const curLat = Number(booking.tech_lat || CITY_CENTER.lat);
    const curLng = Number(booking.tech_lng || CITY_CENTER.lng);
    const dstLat = Number(booking.dest_lat || CITY_CENTER.lat);
    const dstLng = Number(booking.dest_lng || CITY_CENTER.lng);
    const newLat = curLat + (dstLat - curLat) * 0.3;
    const newLng = curLng + (dstLng - curLng) * 0.3;
    await supabase.from("bookings").update({ tech_lat: newLat, tech_lng: newLng }).eq("id", id);
    return response({ tech_lat: newLat, tech_lng: newLng, distance_m: 0 });
  }

  if (path.match(/^\/bookings\/[^/]+\/review$/)) {
    const id = path.split("/")[2];
    const { error } = await supabase.from("bookings").update({ rating: payload.rating, review: payload.review || "" }).eq("id", id);
    if (error) fail(error.message);
    return response({ ok: true });
  }

  if (path === "/diagnosis") {
    await currentUser();
    const { data, error } = await supabase.functions.invoke("diagnose-image", {
      body: payload,
    });
    if (error) {
      let detail = error.message || "AI Lens function failed";
      if (error.name === "FunctionsFetchError") {
        detail = "AI Lens could not reach Supabase. Please sign in again, open the site in Chrome/Safari, and try a smaller photo.";
      } else if (error.context?.clone) {
        try {
          const body = await error.context.clone().json();
          detail = body.error || body.message || detail;
        } catch {
          // Keep the original Supabase error message.
        }
      }
      fail(detail, error.context?.status || 500);
    }
    if (!data) fail("AI Lens returned no diagnosis", 500);
    if (data.error) fail(data.error, 500);
    return response(data);
  }

  if (path === "/diagnosis/chat") {
    await currentUser();
    const { data, error } = await supabase.functions.invoke("ai-lens-chat", {
      body: payload,
    });
    if (error) {
      let detail = error.message || "AI chat failed";
      if (error.name === "FunctionsFetchError") {
        detail = "AI chat could not reach Supabase. Please sign in again, open the site in Chrome/Safari, and try a smaller photo.";
      } else if (error.context?.clone) {
        try {
          const body = await error.context.clone().json();
          detail = body.error || body.message || detail;
        } catch {
          // Keep the original Supabase error message.
        }
      }
      fail(detail, error.context?.status || 500);
    }
    if (!data) fail("AI chat returned no response", 500);
    if (data.error) fail(data.error, 500);
    return response(data);
  }

  if (path === "/parts/estimate") {
    await currentUser();
    const { data, error } = await supabase.functions.invoke("part-price-check", {
      body: payload,
    });
    if (error) {
      let detail = error.message || "Part price check failed";
      if (error.name === "FunctionsFetchError") {
        detail = "Part price check could not reach Supabase. Please sign in again, open the site in Chrome/Safari, and try a smaller photo.";
      } else if (error.context?.clone) {
        try {
          const body = await error.context.clone().json();
          detail = body.error || body.message || detail;
        } catch {
          // Keep the original Supabase error message.
        }
      }
      fail(detail, error.context?.status || 500);
    }
    if (!data) fail("Part price check returned no result", 500);
    if (data.error) fail(data.error, 500);
    return response(data);
  }

  if (path === "/notifications/read-all") {
    const user = await currentUser();
    const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.user_id);
    if (error) fail(error.message);
    return response({ ok: true });
  }

  if (path === "/custom-jobs") {
    const user = await currentUser();
    const { data, error } = await supabase
      .from("custom_jobs")
      .insert({
        user_id: user.user_id,
        user_email: user.email,
        user_name: user.name,
        description: payload.description,
        phone: payload.phone,
        address: payload.address || "",
        preferred_date: payload.preferred_date || null,
        status: "pending_manpower_approval",
      })
      .select("*")
      .single();
    if (error) fail(error.message);
    await createNotification(user.user_id, "Custom job submitted", "Our team will review your request and get back within a few hours.");
    return response(mapCustomJob(data));
  }

  if (path === "/admin/services") {
    await requireAdmin();
    const { data, error } = await supabase
      .from("services")
      .insert({ ...payload, service_code: code("svc"), active: true })
      .select("*")
      .single();
    if (error) fail(error.message);
    return response(mapService(data));
  }

  if (path === "/admin/technicians") {
    await requireAdmin();
    const { data, error } = await supabase
      .from("technicians")
      .insert({ ...payload, status: "approved", picture: payload.picture || "" })
      .select("*")
      .single();
    if (error) fail(error.message);
    return response(mapTechnician(data));
  }

  if (path.match(/^\/admin\/bookings\/[^/]+\/assign$/)) {
    await requireAdmin();
    const bookingId = path.split("/")[3];
    const { data: tech, error: techError } = await supabase.from("technicians").select("*").eq("id", payload.tech_id).maybeSingle();
    if (techError) fail(techError.message);
    if (!tech) fail("Technician not found", 404);
    const { data: existingBooking, error: bookingLookupError } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (bookingLookupError) fail(bookingLookupError.message);
    if (!existingBooking) fail("Booking not found", 404);
    const { data: booking, error } = await supabase
      .from("bookings")
      .update({
        technician_id: tech.id,
        customer_name: existingBooking.customer_name || "Customer",
        customer_email: existingBooking.customer_email || "",
        tech_name: tech.name,
        tech_picture: tech.picture,
        tech_lat: tech.home_lat,
        tech_lng: tech.home_lng,
        status: "assigned",
      })
      .eq("id", bookingId)
      .select("*")
      .single();
    if (error) fail(error.message);
    await createNotification(booking.user_id, "Technician assigned", `${tech.name} has been assigned to your booking.`, booking.id);
    return response(mapBooking(booking));
  }

  if (path.match(/^\/tech\/jobs\/[^/]+\/accept$/)) {
    const tech = await requireTechnician();
    const bookingId = path.split("/")[3];
    const { data, error } = await supabase
      .from("bookings")
      .update({
        technician_id: tech.tech_id,
        tech_name: tech.name,
        tech_picture: tech.picture,
        tech_lat: tech.home_lat,
        tech_lng: tech.home_lng,
        status: "assigned",
      })
      .eq("id", bookingId)
      .select("*")
      .single();
    if (error) fail(error.message);
    await createNotification(data.user_id, "Technician assigned", `${tech.name} accepted your booking.`, data.id);
    return response(mapBooking(data));
  }

  fail(`Unknown Supabase route: ${path}`, 404);
}

async function patch(path, payload = {}) {
  if (path.match(/^\/bookings\/[^/]+\/status$/)) {
    const id = path.split("/")[2];
    const { error } = await supabase.from("bookings").update({ status: payload.status }).eq("id", id);
    if (error) fail(error.message);
    return response({ ok: true, status: payload.status });
  }

  if (path.match(/^\/admin\/bookings\/[^/]+\/status$/)) {
    await requireAdmin();
    const id = path.split("/")[3];
    const { error } = await supabase.from("bookings").update({ status: payload.status }).eq("id", id);
    if (error) fail(error.message);
    return response({ ok: true, status: payload.status });
  }

  if (path.match(/^\/admin\/technicians\/[^/]+\/status$/)) {
    await requireAdmin();
    const id = path.split("/")[3];
    const { data, error } = await supabase.from("technicians").update({ status: payload.status }).eq("id", id).select("*").single();
    if (error) fail(error.message);
    if (payload.status === "approved" && data.user_id) {
      const { error: roleError } = await supabase
        .from("profiles")
        .update({ role: "technician" })
        .eq("id", data.user_id)
        .neq("role", "admin");
      if (roleError) fail(roleError.message);
    }
    return response({ ok: true, status: payload.status });
  }

  if (path.match(/^\/admin\/custom-jobs\/[^/]+\/status$/)) {
    await requireAdmin();
    const id = path.split("/")[3];
    const { data, error } = await supabase.from("custom_jobs").update({ status: payload.status }).eq("id", id).select("*").single();
    if (error) fail(error.message);
    if (payload.status !== "pending_manpower_approval") {
      await createNotification(data.user_id, `Custom request ${payload.status}`, data.description.slice(0, 120));
    }
    return response({ ok: true, status: payload.status });
  }

  if (path.match(/^\/tech\/jobs\/[^/]+\/status$/)) {
    await requireTechnician();
    const id = path.split("/")[3];
    const { error } = await supabase.from("bookings").update({ status: payload.status }).eq("id", id);
    if (error) fail(error.message);
    return response({ ok: true, status: payload.status });
  }

  if (path === "/tech/location") {
    const tech = await requireTechnician();
    const { error } = await supabase
      .from("technicians")
      .update({ home_lat: payload.lat, home_lng: payload.lng, is_available: payload.is_available ?? true })
      .eq("id", tech.tech_id);
    if (error) fail(error.message);
    return response({ ok: true });
  }

  fail(`Unknown Supabase route: ${path}`, 404);
}

async function remove(path) {
  if (path.match(/^\/admin\/services\/[^/]+$/)) {
    await requireAdmin();
    const id = path.split("/")[3];
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) fail(error.message);
    return response({ ok: true });
  }

  if (path.match(/^\/admin\/technicians\/[^/]+$/)) {
    await requireAdmin();
    const id = path.split("/")[3];
    const { error } = await supabase.from("technicians").delete().eq("id", id);
    if (error) fail(error.message);
    return response({ ok: true });
  }

  fail(`Unknown Supabase route: ${path}`, 404);
}

export const supabaseApi = { get, post, patch, delete: remove };

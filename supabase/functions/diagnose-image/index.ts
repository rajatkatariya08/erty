import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_MODEL = "gemini-3.5-flash";
const MAX_INLINE_IMAGE_BYTES = 14 * 1024 * 1024;

const DIAGNOSIS_SCHEMA = {
  type: "object",
  properties: {
    issue_summary: {
      type: "string",
      description: "A short customer-facing summary of the likely issue.",
    },
    detected_problems: {
      type: "array",
      items: { type: "string" },
      description: "Three to five likely visible or user-described problems.",
    },
    severity: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Urgency level for technician inspection.",
    },
    estimated_cost_min: {
      type: "integer",
      description: "Likely minimum visit or repair cost in Indian rupees.",
    },
    estimated_cost_max: {
      type: "integer",
      description: "Likely maximum visit or repair cost in Indian rupees.",
    },
    recommended_service: {
      type: "string",
      description: "The best matching ERTY service name from the provided list.",
    },
    ai_notes: {
      type: "string",
      description: "Helpful explanation, caveats, and next step for the customer.",
    },
    detected_item: {
      type: "string",
      description: "The main visible item, appliance, vehicle, fixture, or problem area.",
    },
    confidence: {
      type: "number",
      description: "Confidence from 0 to 1.",
    },
    safety_note: {
      type: "string",
      description: "A concise safety note when relevant.",
    },
  },
  required: [
    "issue_summary",
    "detected_problems",
    "severity",
    "estimated_cost_min",
    "estimated_cost_max",
    "recommended_service",
    "ai_notes",
    "detected_item",
    "confidence",
    "safety_note",
  ],
};

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  base_price: number;
  market_min: number;
  market_max: number;
  tiers: Array<{ name?: string; price?: number; features?: string[] }>;
};

type DiagnosisPayload = {
  category?: string;
  image_base64?: string;
  user_note?: string;
  language?: string;
};

type GeminiDiagnosis = {
  issue_summary?: string;
  detected_problems?: string[];
  severity?: string;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  recommended_service?: string;
  ai_notes?: string;
  detected_item?: string;
  confidence?: number;
  safety_note?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

function getPublishableKey() {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (anonKey) return anonKey;

  const keysJson = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!keysJson) return "";

  try {
    const keys = JSON.parse(keysJson);
    return keys.default || Object.values(keys)[0] || "";
  } catch {
    return "";
  }
}

function splitImageData(imageBase64: string) {
  const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: "image/jpeg", data: imageBase64 };
}

function base64ByteLength(data: string) {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCategory(value: unknown) {
  const category = stringValue(value, "home_appliances");
  return ["home_appliances", "handyman", "car_and_bike"].includes(category)
    ? category
    : "home_appliances";
}

function servicePriceRange(service?: ServiceRow | null) {
  if (!service) return { min: 499, max: 1999 };
  const tierPrices = (service.tiers || [])
    .map((tier) => Number(tier.price || 0))
    .filter((price) => price > 0);
  const prices = [
    Number(service.base_price || 0),
    Number(service.market_min || 0),
    Number(service.market_max || 0),
    ...tierPrices,
  ].filter((price) => price > 0);
  if (!prices.length) return { min: 499, max: 1999 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function findRecommendedService(services: ServiceRow[], name?: string) {
  if (!services.length) return null;
  const target = (name || "").toLowerCase().trim();
  if (!target) return services[0];

  return (
    services.find((service) => service.name.toLowerCase() === target) ||
    services.find((service) => target.includes(service.name.toLowerCase())) ||
    services.find((service) => service.name.toLowerCase().includes(target)) ||
    services[0]
  );
}

function extractTextFromContent(value: unknown, out: string[] = []) {
  if (!value) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractTextFromContent(item, out));
    return out;
  }
  if (typeof value !== "object") return out;

  const obj = value as Record<string, unknown>;
  if (typeof obj.text === "string") out.push(obj.text);
  if (typeof (obj.text as Record<string, unknown>)?.text === "string") {
    out.push(String((obj.text as Record<string, unknown>).text));
  }
  ["content", "contents", "parts"].forEach((key) => extractTextFromContent(obj[key], out));
  return out;
}

function extractGeminiOutput(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  const obj = payload as Record<string, unknown>;
  if (typeof obj.output_text === "string") return obj.output_text;
  if (typeof obj.outputText === "string") return obj.outputText;
  if (typeof obj.text === "string") return obj.text;

  const stepTexts: string[] = [];
  const steps = (obj.steps || (obj.interaction as Record<string, unknown>)?.steps) as unknown[] | undefined;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      const stepObj = step as Record<string, unknown>;
      extractTextFromContent(stepObj.content, stepTexts);
      extractTextFromContent(stepObj.outputs, stepTexts);
      extractTextFromContent(stepObj.model_output || stepObj.modelOutput, stepTexts);
    }
  }
  if (stepTexts.length) return stepTexts.join("\n");

  const outputTexts: string[] = [];
  extractTextFromContent(obj.outputs, outputTexts);
  if (outputTexts.length) return outputTexts.join("\n");

  const candidateTexts: string[] = [];
  extractTextFromContent(obj.candidates, candidateTexts);
  return candidateTexts.join("\n");
}

function parseModelJson(payload: unknown): GeminiDiagnosis {
  if (payload && typeof payload === "object" && "issue_summary" in (payload as Record<string, unknown>)) {
    return payload as GeminiDiagnosis;
  }

  const rawText = extractGeminiOutput(payload)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!rawText) {
    throw new Error("Gemini returned an empty response. Please retake the photo with better lighting and try again.");
  }

  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? rawText.slice(start, end + 1) : rawText;
  return JSON.parse(jsonText);
}

function normalizeDiagnosis(result: GeminiDiagnosis, category: string, matchedService: ServiceRow | null) {
  const fallbackRange = servicePriceRange(matchedService);
  const severity = ["low", "medium", "high"].includes(String(result.severity))
    ? String(result.severity)
    : "medium";

  let min = clamp(numberValue(result.estimated_cost_min, fallbackRange.min), 0, 999999);
  let max = clamp(numberValue(result.estimated_cost_max, fallbackRange.max), 0, 999999);
  if (max < min) max = min;

  const problems = Array.isArray(result.detected_problems)
    ? result.detected_problems.map((item) => stringValue(item)).filter(Boolean).slice(0, 5)
    : [];

  return {
    category,
    issue_summary: stringValue(result.issue_summary, "Technician inspection recommended"),
    detected_problems: problems.length ? problems : ["Issue visible in photo", "Technician inspection recommended"],
    severity,
    estimated_cost_min: min,
    estimated_cost_max: max,
    recommended_service: matchedService?.name || stringValue(result.recommended_service, "General inspection"),
    recommended_service_id: matchedService?.id || null,
    ai_notes: stringValue(result.ai_notes, "This is an AI estimate. Final diagnosis and pricing will be confirmed by the technician."),
    detected_item: stringValue(result.detected_item, ""),
    confidence: clamp(Number(result.confidence || 0.6), 0, 1),
    safety_note: stringValue(result.safety_note, ""),
  };
}

function buildPrompt(category: string, language: string, userNote: string, services: ServiceRow[]) {
  const serviceLines = services
    .map((service) => {
      const range = servicePriceRange(service);
      return `- ${service.name}: INR ${range.min}-${range.max}`;
    })
    .join("\n");

  return `
You are ERTY AI Lens for doorstep home, handyman, car, and bike repair in Gurugram, India.

Analyze the uploaded customer photo and optional note. Give a likely diagnosis, not a guaranteed final answer. A human technician will confirm the issue and price.

Selected category: ${category}
Preferred response language: ${language}
Customer note: ${userNote || "none"}

Available ERTY services in this category:
${serviceLines || "- General inspection"}

Rules:
- Choose recommended_service exactly from the service list when possible.
- Keep prices realistic for Gurugram doorstep repair in INR.
- Do not provide dangerous repair instructions. Recommend switching off power/water/fuel when relevant.
- If the photo is unclear, say so and recommend a technician inspection.
- Return only valid JSON matching the provided schema.
`.trim();
}

async function callGemini(image: { mimeType: string; data: string }, prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing in Supabase secrets");

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      store: false,
      generation_config: {
        temperature: 0.2,
      },
      input: [
        { type: "text", text: prompt },
        { type: "image", data: image.data, mime_type: image.mimeType },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: DIAGNOSIS_SCHEMA,
      },
    }),
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep raw text for parseModelJson.
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null
      ? JSON.stringify(payload)
      : text;
    throw new Error(`Gemini request failed: ${message.slice(0, 400)}`);
  }

  return parseModelJson(payload);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = getPublishableKey();
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseKey) return fail("Supabase function environment is not ready", 500);
    if (!authHeader) return fail("Please sign in before using AI Lens", 401);

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return fail("Please sign in again before using AI Lens", 401);

    const body = (await req.json()) as DiagnosisPayload;
    const category = normalizeCategory(body.category);
    const language = stringValue(body.language, "English");
    const userNote = stringValue(body.user_note);
    if (!body.image_base64) return fail("Please upload or capture a photo first");

    const image = splitImageData(body.image_base64);
    if (!image.mimeType.startsWith("image/")) return fail("Please upload a valid image");
    if (base64ByteLength(image.data) > MAX_INLINE_IMAGE_BYTES) {
      return fail("Image is too large. Please upload a smaller or compressed photo");
    }

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id,name,category,base_price,market_min,market_max,tiers")
      .eq("category", category)
      .eq("active", true);

    if (servicesError) return fail(servicesError.message, 500);

    const serviceRows = (services || []) as ServiceRow[];
    const prompt = buildPrompt(category, language, userNote, serviceRows);
    const geminiResult = await callGemini(image, prompt);
    const matchedService = findRecommendedService(serviceRows, geminiResult.recommended_service);
    const diagnosis = normalizeDiagnosis(geminiResult, category, matchedService);

    const { data: inserted, error: insertError } = await supabase
      .from("diagnoses")
      .insert({
        user_id: authData.user.id,
        category,
        issue_summary: diagnosis.issue_summary,
        detected_problems: diagnosis.detected_problems,
        severity: diagnosis.severity,
        estimated_cost_min: diagnosis.estimated_cost_min,
        estimated_cost_max: diagnosis.estimated_cost_max,
        recommended_service: diagnosis.recommended_service,
        ai_notes: [diagnosis.ai_notes, diagnosis.safety_note].filter(Boolean).join("\n\n"),
        image_thumb: body.image_base64.slice(0, 12000),
        language,
      })
      .select("*")
      .single();

    if (insertError) return fail(insertError.message, 500);

    return json({
      diagnosis_id: inserted.id,
      user_id: inserted.user_id,
      category: inserted.category,
      issue_summary: inserted.issue_summary,
      detected_problems: inserted.detected_problems || [],
      severity: inserted.severity,
      estimated_cost_min: inserted.estimated_cost_min,
      estimated_cost_max: inserted.estimated_cost_max,
      recommended_service: inserted.recommended_service,
      recommended_service_id: diagnosis.recommended_service_id,
      ai_notes: inserted.ai_notes,
      image_thumb: inserted.image_thumb,
      language: inserted.language,
      detected_item: diagnosis.detected_item,
      confidence: diagnosis.confidence,
      test_mode: false,
      created_at: inserted.created_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed";
    return fail(message, 500);
  }
});

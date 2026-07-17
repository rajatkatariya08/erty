import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_MODEL = "gemini-3.5-flash";
const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
const MAX_INLINE_IMAGE_BYTES = 14 * 1024 * 1024;

const PART_SCHEMA = {
  type: "object",
  properties: {
    appliance_type: { type: "string" },
    brand: { type: "string" },
    model_number: { type: "string" },
    summary: { type: "string" },
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          part_name: { type: "string" },
          reason: { type: "string" },
          search_query: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["part_name", "reason", "search_query", "confidence"],
      },
    },
  },
  required: ["appliance_type", "brand", "model_number", "summary", "parts"],
};

type PricePayload = {
  category?: string;
  image_base64?: string;
  user_note?: string;
  model_details?: string;
  diagnosis?: {
    issue_summary?: string;
    detected_problems?: string[];
    recommended_service?: string;
    ai_notes?: string;
  };
  location?: string;
  language?: string;
};

type CandidatePart = {
  part_name: string;
  reason: string;
  search_query: string;
  confidence: number;
};

type PartSuggestion = {
  appliance_type?: string;
  brand?: string;
  model_number?: string;
  summary?: string;
  parts?: CandidatePart[];
};

type MarketListing = {
  title: string;
  source: string;
  price: string;
  extracted_price: number;
  link: string;
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
    const firstKey = keys.default || Object.values(keys)[0];
    return typeof firstKey === "string" ? firstKey : "";
  } catch {
    return "";
  }
}

function splitImageData(imageBase64: string) {
  const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: "image/jpeg", data: imageBase64 };
}

function base64ByteLength(data: string) {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function extractText(value: unknown, out: string[] = []) {
  if (!value) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractText(item, out));
    return out;
  }
  if (typeof value !== "object") return out;

  const obj = value as Record<string, unknown>;
  if (typeof obj.text === "string") out.push(obj.text);
  ["content", "contents", "parts", "outputs"].forEach((key) => extractText(obj[key], out));
  return out;
}

function extractGeminiText(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  const obj = payload as Record<string, unknown>;
  if (typeof obj.output_text === "string") return obj.output_text;
  if (typeof obj.outputText === "string") return obj.outputText;

  const stepTexts: string[] = [];
  const steps = (obj.steps || (obj.interaction as Record<string, unknown>)?.steps) as unknown[] | undefined;
  if (Array.isArray(steps)) {
    steps.forEach((step) => extractText((step as Record<string, unknown>).content, stepTexts));
  }
  if (stepTexts.length) return stepTexts.join("\n");

  const texts: string[] = [];
  extractText(obj.outputs, texts);
  extractText(obj.candidates, texts);
  return texts.join("\n");
}

function parseModelJson(payload: unknown): PartSuggestion {
  const rawText = extractGeminiText(payload)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!rawText) throw new Error("AI could not identify possible parts. Please add brand/model details and try again.");

  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? rawText.slice(start, end + 1) : rawText;
  return JSON.parse(jsonText);
}

function buildPartPrompt(body: PricePayload) {
  const diagnosis = body.diagnosis || {};
  const problems = Array.isArray(diagnosis.detected_problems) ? diagnosis.detected_problems.join(", ") : "";

  return `
You are ERTY's appliance repair market-price assistant.

Goal: identify possible replaceable parts only. ERTY does not sell parts. Customer wants market price awareness so technicians cannot overcharge them.

Category: ${body.category || "unknown"}
Customer model details: ${body.model_details || "not provided"}
Customer note: ${body.user_note || "none"}
Diagnosis summary: ${diagnosis.issue_summary || "none"}
Detected problems: ${problems || "none"}
Recommended service: ${diagnosis.recommended_service || "none"}

Return likely replaceable parts. If exact model is missing, use generic parts for the visible/likely appliance and say confidence is lower.
For each part, create a search_query suitable for Google Shopping in India. Include brand/model only if provided or visible.
Avoid entire appliance prices. Focus on spare/replacement parts.
Return only JSON matching the schema.
`.trim();
}

async function callGemini(image: { mimeType: string; data: string } | null, prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing in Supabase secrets");

  const input: unknown[] = [{ type: "text", text: prompt }];
  if (image) input.push({ type: "image", data: image.data, mime_type: image.mimeType });

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      store: false,
      generation_config: { temperature: 0.15 },
      input,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: PART_SCHEMA,
      },
    }),
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep raw text fallback.
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null ? JSON.stringify(payload) : text;
    throw new Error(`Gemini part analysis failed: ${message.slice(0, 400)}`);
  }

  return parseModelJson(payload);
}

function normalizePrice(value: unknown, priceText = "") {
  const direct = numberValue(value, 0);
  if (direct > 0) return direct;

  const cleaned = priceText.replace(/,/g, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function flattenShoppingResults(payload: Record<string, unknown>) {
  const direct = Array.isArray(payload.shopping_results) ? payload.shopping_results : [];
  const categorized = Array.isArray(payload.categorized_shopping_results)
    ? payload.categorized_shopping_results.flatMap((group) => {
        const results = (group as Record<string, unknown>).shopping_results;
        return Array.isArray(results) ? results : [];
      })
    : [];
  return [...direct, ...categorized] as Record<string, unknown>[];
}

function scoreListing(query: string, partName: string, listing: MarketListing) {
  const haystack = `${listing.title} ${listing.source}`.toLowerCase();
  const terms = `${query} ${partName}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !["for", "the", "and", "with", "spare", "replacement", "india"].includes(term));

  const uniqueTerms = [...new Set(terms)];
  const matches = uniqueTerms.filter((term) => haystack.includes(term)).length;
  return matches / Math.max(uniqueTerms.length, 1);
}

async function searchPartPrices(part: CandidatePart, location: string) {
  const apiKey = Deno.env.get("SERPAPI_API_KEY") || Deno.env.get("SERPAPI_KEY");
  if (!apiKey) return { needs_market_api: true, listings: [] as MarketListing[] };

  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", part.search_query);
  url.searchParams.set("location", location || "Gurugram, Haryana, India");
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString());
  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Market search returned an unreadable response");
  }

  if (!response.ok || payload.error) {
    throw new Error(String(payload.error || "Market search failed"));
  }

  const listings = flattenShoppingResults(payload)
    .map((item) => {
      const price = stringValue(item.price);
      return {
        title: stringValue(item.title),
        source: stringValue(item.source),
        price,
        extracted_price: normalizePrice(item.extracted_price, price),
        link: stringValue(item.link) || stringValue(item.product_link),
      };
    })
    .filter((item) => item.title && item.extracted_price > 0 && item.extracted_price < 100000)
    .filter((item) => scoreListing(part.search_query, part.part_name, item) >= 0.2)
    .slice(0, 8);

  return { needs_market_api: false, listings };
}

function summarizePriceRange(listings: MarketListing[]) {
  const prices = listings.map((item) => item.extracted_price).filter((price) => price > 0).sort((a, b) => a - b);
  if (!prices.length) return { min: null, max: null };

  const trimmed = prices.length >= 5 ? prices.slice(1, -1) : prices;
  return {
    min: Math.round(Math.min(...trimmed)),
    max: Math.round(Math.max(...trimmed)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = getPublishableKey();
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseKey) return fail("Supabase function environment is not ready", 500);
    if (!authHeader) return fail("Please sign in before checking part prices", 401);

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return fail("Please sign in again before checking part prices", 401);

    const body = (await req.json()) as PricePayload;
    let image: { mimeType: string; data: string } | null = null;
    if (body.image_base64) {
      image = splitImageData(body.image_base64);
      if (!image.mimeType.startsWith("image/")) return fail("Please upload a valid image");
      if (base64ByteLength(image.data) > MAX_INLINE_IMAGE_BYTES) {
        return fail("Image is too large. Please retake or upload a smaller photo");
      }
    }

    if (!image && !body.model_details && !body.diagnosis?.issue_summary) {
      return fail("Please add model details or run a diagnosis first");
    }

    const suggestion = await callGemini(image, buildPartPrompt(body));
    const location = stringValue(body.location, "Gurugram, Haryana, India");
    const rawParts = Array.isArray(suggestion.parts) ? suggestion.parts.slice(0, 4) : [];

    const parts = [];
    let needsMarketApi = false;
    for (const part of rawParts) {
      const candidate = {
        part_name: stringValue(part.part_name, "Replacement part"),
        reason: stringValue(part.reason, "Possible part based on the issue"),
        search_query: stringValue(part.search_query, `${part.part_name || "appliance spare part"} India`),
        confidence: Math.min(1, Math.max(0, numberValue(part.confidence, 0.5))),
      };

      const result = await searchPartPrices(candidate, location);
      needsMarketApi ||= result.needs_market_api;
      const range = summarizePriceRange(result.listings);
      parts.push({
        ...candidate,
        price_min: range.min,
        price_max: range.max,
        sample_count: result.listings.length,
        sources: result.listings.slice(0, 5),
      });
    }

    return json({
      checked_at: new Date().toISOString(),
      location,
      currency: "INR",
      needs_market_api: needsMarketApi,
      appliance_type: stringValue(suggestion.appliance_type, "Appliance"),
      brand: stringValue(suggestion.brand),
      model_number: stringValue(suggestion.model_number),
      summary: stringValue(suggestion.summary, "Market estimate for likely replacement parts."),
      parts,
      disclaimer: "Market estimate only. ERTY does not sell parts. Final part need and price must be confirmed after technician inspection.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Part price check failed";
    return fail(message, 500);
  }
});

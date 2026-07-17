import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_MODEL = "gemini-3.5-flash";
const MAX_INLINE_IMAGE_BYTES = 14 * 1024 * 1024;

type ChatPayload = {
  category?: string;
  image_base64?: string;
  message?: string;
  language?: string;
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

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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

function buildPrompt(category: string, language: string, message: string) {
  return `
You are ERTY AI Lens, a concise repair assistant for doorstep services in Gurugram, India.

User selected category: ${category || "unknown"}
Preferred language: ${language || "English"}
User question: ${message || "What do you see? Guide me."}

Look at the image and answer conversationally in 3 to 6 short lines.
Mention likely issue, what the customer should check safely, and whether a technician should inspect it.
Do not give dangerous electrical, gas, fuel, or mechanical repair instructions.
Do not claim certainty; use words like likely, possible, or appears.
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
      generation_config: { temperature: 0.35 },
      input: [
        { type: "text", text: prompt },
        { type: "image", data: image.data, mime_type: image.mimeType },
      ],
    }),
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Raw text fallback.
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null ? JSON.stringify(payload) : text;
    throw new Error(`Gemini chat failed: ${message.slice(0, 400)}`);
  }

  const output = extractGeminiText(payload).trim();
  if (!output) throw new Error("Gemini returned an empty chat response. Please retake the photo and try again.");
  return output;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = getPublishableKey();
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseKey) return fail("Supabase function environment is not ready", 500);
    if (!authHeader) return fail("Please sign in before using AI chat", 401);

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return fail("Please sign in again before using AI chat", 401);

    const body = (await req.json()) as ChatPayload;
    if (!body.image_base64) return fail("Please capture or upload a photo first");

    const image = splitImageData(body.image_base64);
    if (!image.mimeType.startsWith("image/")) return fail("Please upload a valid image");
    if (base64ByteLength(image.data) > MAX_INLINE_IMAGE_BYTES) {
      return fail("Image is too large. Please retake or upload a smaller photo");
    }

    const answer = await callGemini(
      image,
      buildPrompt(
        stringValue(body.category, "unknown"),
        stringValue(body.language, "English"),
        stringValue(body.message, "What do you see? Guide me."),
      ),
    );

    return json({ message: answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI chat failed";
    return fail(message, 500);
  }
});

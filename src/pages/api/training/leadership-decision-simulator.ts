import type { APIRoute } from "astro";
export const prerender = false;

type SimulatorMode = "generate" | "evaluate";

interface GeneratePayload {
  mode: "generate";
  role: string;
  challenge: string;
  difficulty: string;
}

interface EvaluatePayload {
  mode: "evaluate";
  role: string;
  challenge: string;
  difficulty: string;
  scenario: string;
  options: string[];
  selectedOption: string;
  rationale: string;
}

function getApiConfig() {
  const baseUrl = import.meta.env.LUMINATION_API_BASE_URL;
  const apiKey = import.meta.env.LUMINATION_API_KEY;

  if (!baseUrl || !apiKey) {
    return null;
  }

  return {
    baseUrl: String(baseUrl).replace(/\/+$/, ""),
    apiKey: String(apiKey),
  };
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function extractAssistantText(response: any): string {
  const nestedResponse = response?.response?.response;
  if (typeof nestedResponse === "string" && nestedResponse.trim()) {
    return nestedResponse.trim();
  }

  const nestedContent = response?.response?.content;
  if (typeof nestedContent === "string" && nestedContent.trim()) {
    return nestedContent.trim();
  }

  if (typeof response?.message === "string" && response.message.trim()) {
    return response.message.trim();
  }

  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item: any) => item?.text || item?.content || "")
      .join("")
      .trim();
  }

  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  return "";
}

function normalizeJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const raw = text.match(/```([\s\S]*?)```/);
  if (raw?.[1]) {
    return raw[1].trim();
  }

  return text.trim();
}

function sectionBetween(text: string, startHeading: string, nextHeading?: string) {
  const startRegex = new RegExp(`##\\s*${startHeading}\\s*`, "i");
  const startMatch = text.match(startRegex);
  if (!startMatch || startMatch.index === undefined) return "";
  const from = startMatch.index + startMatch[0].length;
  if (!nextHeading) return text.slice(from).trim();
  const endRegex = new RegExp(`\\n##\\s*${nextHeading}\\s*`, "i");
  const endMatch = text.slice(from).match(endRegex);
  if (!endMatch || endMatch.index === undefined) return text.slice(from).trim();
  return text.slice(from, from + endMatch.index).trim();
}

function parseGenerateFallback(raw: string): Record<string, unknown> | null {
  const scenario = sectionBetween(raw, "Scenario", "Options");
  const optionsSection = sectionBetween(raw, "Options", "Best Option");
  const options = optionsSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").trim());

  const bestOptionRaw = sectionBetween(raw, "Best Option", "Risk If Wrong");
  const bestOption = bestOptionRaw.replace(/^The best option is:\s*/i, "").trim();
  const risk = sectionBetween(raw, "Risk If Wrong", "Coaching Tip");
  const coachingTip = sectionBetween(raw, "Coaching Tip");

  if (!scenario || options.length === 0) return null;
  return {
    scenario,
    options,
    best_option: bestOption || options[0],
    risk_if_wrong: risk || "",
    coaching_tip: coachingTip || "",
  };
}

function parseEvaluateFallback(raw: string): Record<string, unknown> {
  const scoreMatch = raw.match(/\bscore\b[^0-9]{0,20}(\d{1,3})/i);
  const score = scoreMatch ? Math.min(100, Math.max(0, Number(scoreMatch[1]))) : 70;
  return {
    score,
    verdict: "Coaching feedback generated.",
    blind_spot: "See what_to_improve.",
    what_worked: raw.slice(0, 300).trim(),
    what_to_improve: raw.slice(300, 900).trim() || "Clarify rationale and stakeholder impact.",
    next_action: "Run the scenario again and test an alternative option.",
  };
}

function buildGeneratePrompt(data: GeneratePayload) {
  return [
    "You are a leadership simulation designer.",
    "Return strict JSON only with keys:",
    "scenario (string), options (array of exactly 4 strings),",
    "best_option (string equal to one options item),",
    "risk_if_wrong (string), and coaching_tip (string).",
    "No markdown, no extra keys.",
    "",
    `Role: ${data.role}`,
    `Challenge type: ${data.challenge}`,
    `Difficulty: ${data.difficulty}`,
    "Create one realistic corporate training scenario for a first-line manager.",
    "The options must be plausible trade-offs, not obvious right/wrong."
  ].join("\n");
}

function buildEvaluatePrompt(data: EvaluatePayload) {
  return [
    "You are a leadership coach evaluating a manager decision.",
    "Return strict JSON only with keys:",
    "score (0-100 integer), verdict (string), blind_spot (string),",
    "what_worked (string), what_to_improve (string), next_action (string).",
    "No markdown, no extra keys.",
    "",
    `Role: ${data.role}`,
    `Challenge type: ${data.challenge}`,
    `Difficulty: ${data.difficulty}`,
    `Scenario: ${data.scenario}`,
    `Options: ${data.options.join(" | ")}`,
    `Selected option: ${data.selectedOption}`,
    `Rationale: ${data.rationale}`
  ].join("\n");
}

async function callAgent(config: { baseUrl: string; apiKey: string }, prompt: string) {
  const endpoint = `${config.baseUrl}/lumination-ai/api/v1/agent/chat`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.apiKey,
      "X-REQUEST-ID": `leadership-sim-${Date.now()}`,
    },
    body: JSON.stringify({
      persist: false,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return { ok: false, status: upstream.status, data };
  }

  return { ok: true, status: upstream.status, data };
}

export const GET: APIRoute = async () =>
  jsonResponse(200, {
    ok: true,
    message: "Leadership Decision Simulator API is running. Use POST.",
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const config = getApiConfig();
    if (!config) {
      return jsonResponse(500, {
        error: "Server is missing Lumination API env vars.",
      });
    }

    let body: GeneratePayload | EvaluatePayload;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body." });
    }

    const mode = safeText((body as { mode?: SimulatorMode }).mode) as SimulatorMode;
    if (mode !== "generate" && mode !== "evaluate") {
      return jsonResponse(400, { error: "mode must be either generate or evaluate." });
    }

    const role = safeText((body as any).role);
    const challenge = safeText((body as any).challenge);
    const difficulty = safeText((body as any).difficulty);

    if (!role || !challenge || !difficulty) {
      return jsonResponse(400, { error: "role, challenge and difficulty are required." });
    }

    const prompt =
      mode === "generate"
        ? buildGeneratePrompt(body as GeneratePayload)
        : buildEvaluatePrompt(body as EvaluatePayload);

    const upstream = await callAgent(config, prompt);
    if (!upstream.ok) {
      return jsonResponse(upstream.status, {
        error: "Lumination API request failed.",
        details: upstream.data,
      });
    }

    const assistantText = extractAssistantText(upstream.data);
    const normalized = normalizeJsonBlock(assistantText);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      const fallback =
        mode === "generate"
          ? parseGenerateFallback(assistantText)
          : parseEvaluateFallback(assistantText);

      if (!fallback) {
        return jsonResponse(502, {
          error: "Agent did not return valid JSON.",
          raw: assistantText,
        });
      }

      parsed = fallback;
    }

    return jsonResponse(200, { mode, result: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse(500, { error: message });
  }
};

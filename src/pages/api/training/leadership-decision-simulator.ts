import type { APIRoute } from "astro";

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
      return jsonResponse(502, {
        error: "Agent did not return valid JSON.",
        raw: assistantText,
      });
    }

    return jsonResponse(200, { mode, result: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse(500, { error: message });
  }
};

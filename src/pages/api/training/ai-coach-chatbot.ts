import type { APIRoute } from "astro";
export const prerender = false;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  message: string;
  contextText?: string;
  history?: ChatMessage[];
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function getApiConfig() {
  const baseUrl = import.meta.env.LUMINATION_API_BASE_URL;
  const apiKey = import.meta.env.LUMINATION_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: String(baseUrl).replace(/\/+$/, ""),
    apiKey: String(apiKey),
  };
}

function extractAssistantText(response: any): string {
  const nestedResponse = response?.response?.response;
  if (typeof nestedResponse === "string" && nestedResponse.trim()) return nestedResponse.trim();

  const nestedContent = response?.response?.content;
  if (typeof nestedContent === "string" && nestedContent.trim()) return nestedContent.trim();

  if (typeof response?.message === "string" && response.message.trim()) return response.message.trim();

  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item: any) => item?.text || item?.content || "")
      .join("")
      .trim();
  }

  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  return "";
}

function buildPrompt(body: ChatBody) {
  const message = safeText(body.message);
  const contextText = safeText(body.contextText).slice(0, 22000);
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

  const historyBlock = history
    .map((entry) => `${entry.role.toUpperCase()}: ${safeText(entry.content)}`)
    .filter(Boolean)
    .join("\n\n");

  return [
    "You are an AI Coach for training and development.",
    "Style: clear, practical, and encouraging without fluff.",
    "When solving homework-style prompts, explain steps and reasoning.",
    "If context is missing, ask one concise clarifying question.",
    "Prefer actionable guidance, checklists, and examples.",
    "",
    contextText ? `Context (PDF/OCR text):\n${contextText}` : "No external context provided.",
    historyBlock ? `Conversation so far:\n${historyBlock}` : "No conversation history.",
    "",
    `User message:\n${message}`,
  ].join("\n");
}

async function callAgent(config: { baseUrl: string; apiKey: string }, prompt: string) {
  const endpoint = `${config.baseUrl}/lumination-ai/api/v1/agent/chat`;

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.apiKey,
      "X-REQUEST-ID": `ai-coach-${Date.now()}`,
    },
    body: JSON.stringify({
      persist: false,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await upstream.json().catch(() => ({}));
  return { ok: upstream.ok, status: upstream.status, data };
}

export const GET: APIRoute = async () =>
  jsonResponse(200, {
    ok: true,
    message: "AI Coach Chatbot API is running. Use POST.",
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const config = getApiConfig();
    if (!config) {
      return jsonResponse(500, { error: "Server is missing Lumination API env vars." });
    }

    let body: ChatBody;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body." });
    }

    const message = safeText(body.message);
    if (!message) return jsonResponse(400, { error: "message is required." });

    const prompt = buildPrompt(body);
    const upstream = await callAgent(config, prompt);
    if (!upstream.ok) {
      return jsonResponse(upstream.status, {
        error: `Lumination API request failed (status ${upstream.status}).`,
        details: upstream.data,
      });
    }

    const reply = extractAssistantText(upstream.data);
    if (!reply) {
      return jsonResponse(502, { error: "Agent returned an empty response." });
    }

    return jsonResponse(200, { reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse(500, { error: message });
  }
};


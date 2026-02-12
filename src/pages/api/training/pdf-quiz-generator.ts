import type { APIRoute } from "astro";
export const prerender = false;

interface QuizRequestBody {
  sourceText: string;
  questionCount: number;
  difficulty?: string;
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

  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  return "";
}

function normalizeJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const raw = text.match(/```([\s\S]*?)```/);
  if (raw?.[1]) return raw[1].trim();
  return text.trim();
}

function buildPrompt(payload: QuizRequestBody) {
  return [
    "You are an assessment designer for corporate learning.",
    "Create a multiple-choice quiz based strictly on the provided source text.",
    "Return strict JSON only, no markdown, no extra keys.",
    'JSON shape: {"title":"string","questions":[{"question":"string","choices":["a","b","c","d"],"correctIndex":0,"explanation":"string"}]}',
    "Rules:",
    `- Generate exactly ${payload.questionCount} questions.`,
    "- choices must always contain exactly 4 options.",
    "- correctIndex must be integer 0..3 and correspond to the right choice.",
    "- Questions must be clear and practical for professional learning.",
    "- Avoid trick questions and avoid duplicate questions.",
    `- Difficulty target: ${safeText(payload.difficulty) || "intermediate"}.`,
    "",
    "Source text:",
    payload.sourceText,
  ].join("\n");
}

async function callAgent(config: { baseUrl: string; apiKey: string }, prompt: string) {
  const endpoint = `${config.baseUrl}/lumination-ai/api/v1/agent/chat`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.apiKey,
      "X-REQUEST-ID": `quiz-${Date.now()}`,
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
    message: "PDF Quiz Generator API is running. Use POST.",
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const config = getApiConfig();
    if (!config) {
      return jsonResponse(500, { error: "Server is missing Lumination API env vars." });
    }

    let body: QuizRequestBody;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body." });
    }

    const sourceText = safeText(body.sourceText).slice(0, 30000);
    const questionCount = Math.min(20, Math.max(1, Number(body.questionCount || 1)));
    const difficulty = safeText(body.difficulty || "intermediate");

    if (!sourceText) {
      return jsonResponse(400, { error: "sourceText is required." });
    }

    const prompt = buildPrompt({ sourceText, questionCount, difficulty });
    const upstream = await callAgent(config, prompt);
    if (!upstream.ok) {
      return jsonResponse(upstream.status, {
        error: `Lumination API request failed (status ${upstream.status}).`,
        details: upstream.data,
      });
    }

    const assistantText = extractAssistantText(upstream.data);
    const normalized = normalizeJsonBlock(assistantText);
    let parsed: any;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      return jsonResponse(502, {
        error: "Agent did not return valid JSON for quiz.",
        raw: assistantText,
      });
    }

    if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
      return jsonResponse(502, { error: "Invalid quiz payload: questions missing." });
    }

    const questions = parsed.questions
      .map((q: any) => {
        const question = safeText(q?.question);
        const choices = Array.isArray(q?.choices) ? q.choices.map((c: unknown) => safeText(c)).filter(Boolean) : [];
        const correctIndex = Number(q?.correctIndex);
        const explanation = safeText(q?.explanation);
        return { question, choices, correctIndex, explanation };
      })
      .filter((q: any) => q.question && q.choices.length === 4 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 3)
      .slice(0, questionCount);

    if (questions.length === 0) {
      return jsonResponse(502, { error: "Agent returned quiz data but could not validate questions." });
    }

    return jsonResponse(200, {
      result: {
        title: safeText(parsed?.title) || "Document Quiz",
        questions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse(500, { error: message });
  }
};


import type { APIRoute } from "astro";
export const prerender = false;

interface QuizRequestBody {
  sourceText: string;
  questionCount: number;
  difficulty?: string;
}

interface NormalizedQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
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

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function coerceCorrectIndex(value: unknown, choicesLength: number) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < choicesLength) return numeric;

  const asText = safeText(value).toUpperCase();
  const letterIndex = ["A", "B", "C", "D"].indexOf(asText.replace(/[^A-D]/g, "").slice(0, 1));
  if (letterIndex >= 0 && letterIndex < choicesLength) return letterIndex;

  const oneBased = Number(asText.replace(/[^0-9]/g, ""));
  if (Number.isInteger(oneBased) && oneBased >= 1 && oneBased <= choicesLength) return oneBased - 1;

  return -1;
}

function normalizeQuestions(input: unknown, questionCount: number): NormalizedQuestion[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((q: any) => {
      const question = safeText(q?.question || q?.prompt || q?.title);
      const choicesRaw = Array.isArray(q?.choices)
        ? q.choices
        : Array.isArray(q?.options)
          ? q.options
          : Array.isArray(q?.answers)
            ? q.answers
            : [];
      const choices = choicesRaw.map((c: unknown) => safeText(c)).filter(Boolean).slice(0, 4);
      const correctIndex = coerceCorrectIndex(
        q?.correctIndex ?? q?.correct_index ?? q?.correct ?? q?.answer ?? q?.correctAnswer,
        choices.length,
      );
      const explanation = safeText(q?.explanation || q?.rationale || q?.why || "");
      return { question, choices, correctIndex, explanation };
    })
    .filter((q: NormalizedQuestion) => q.question && q.choices.length === 4 && q.correctIndex >= 0 && q.correctIndex <= 3)
    .slice(0, questionCount);
}

function parseQuizFallback(raw: string, questionCount: number): NormalizedQuestion[] {
  const blocks = raw
    .split(/\n(?=\s*(?:Q?\d+[\).:-]\s+|Question\s+\d+[:.-]))/i)
    .map((b) => b.trim())
    .filter(Boolean);

  const parsed: NormalizedQuestion[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    const question = lines[0].replace(/^(?:Question\s*)?\d+[\).:-]\s*/i, "").trim();
    const optionLines = lines
      .slice(1)
      .filter((line) => /^([A-D][\).:-]\s+|[-*]\s+|\d+[\).:-]\s+)/i.test(line))
      .map((line) => line.replace(/^([A-D]|\d+)[\).:-]\s*|^[-*]\s*/i, "").trim())
      .filter(Boolean)
      .slice(0, 4);

    if (!question || optionLines.length < 4) continue;

    let correctIndex = 0;
    const correctLine = lines.find((line) => /^(correct|answer)\s*[:=-]/i.test(line));
    if (correctLine) {
      correctIndex = coerceCorrectIndex(correctLine.split(/[:=-]/).slice(1).join(" "), 4);
      if (correctIndex < 0) correctIndex = 0;
    }

    const explanationLine = lines.find((line) => /^(explanation|because|rationale)\s*[:=-]/i.test(line));
    const explanation = explanationLine ? explanationLine.split(/[:=-]/).slice(1).join(" ").trim() : "";

    parsed.push({
      question,
      choices: optionLines,
      correctIndex,
      explanation,
    });

    if (parsed.length >= questionCount) break;
  }

  return parsed;
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

async function repairQuizJson(
  config: { baseUrl: string; apiKey: string },
  rawOutput: string,
  questionCount: number,
) {
  const repairPrompt = [
    "Convert the following content into strict JSON only.",
    'Target shape: {"title":"string","questions":[{"question":"string","choices":["a","b","c","d"],"correctIndex":0,"explanation":"string"}]}',
    `Keep exactly ${questionCount} questions when possible.`,
    "No markdown fences.",
    "",
    rawOutput.slice(0, 22000),
  ].join("\n");

  const repaired = await callAgent(config, repairPrompt);
  if (!repaired.ok) return null;

  const text = extractAssistantText(repaired.data);
  const normalized = normalizeJsonBlock(text);
  return tryParseJson(normalized);
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

    let parsed = tryParseJson(normalized);

    if (!parsed) {
      const firstBrace = normalized.indexOf("{");
      const lastBrace = normalized.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        parsed = tryParseJson(normalized.slice(firstBrace, lastBrace + 1));
      }
    }

    if (!parsed) {
      parsed = await repairQuizJson(config, assistantText, questionCount);
    }

    let questions = normalizeQuestions(parsed?.questions, questionCount);
    if (questions.length === 0) {
      questions = parseQuizFallback(assistantText, questionCount);
    }

    if (questions.length === 0) {
      return jsonResponse(502, {
        error: "Agent returned content but no valid quiz questions could be parsed.",
        raw: assistantText.slice(0, 3000),
      });
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

export const MAX_QUESTION_CHARS = 500;
export const MAX_HISTORY_MESSAGES = 6;
export const MAX_HISTORY_MESSAGE_CHARS = 1000;

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  question: string;
  history: Turn[];
}

export type Validation = { ok: true; value: ChatRequest } | { ok: false; error: string };

// Control characters except tab and newline.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

function clean(text: string): string {
  return text.replace(CONTROL, "").trim();
}

/** Validates the untrusted request body before anything reaches the model. */
export function validateRequest(body: unknown): Validation {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Body must be a JSON object." };
  const { question, history = [] } = body as { question?: unknown; history?: unknown };

  if (typeof question !== "string") return { ok: false, error: "question must be a string." };
  const q = clean(question);
  if (q.length === 0) return { ok: false, error: "question is empty." };
  if (q.length > MAX_QUESTION_CHARS) return { ok: false, error: `question is longer than ${MAX_QUESTION_CHARS} characters.` };

  if (!Array.isArray(history)) return { ok: false, error: "history must be an array." };
  if (history.length > MAX_HISTORY_MESSAGES) return { ok: false, error: `history has more than ${MAX_HISTORY_MESSAGES} messages.` };

  const turns: Turn[] = [];
  for (const [i, item] of history.entries()) {
    const expected: Turn["role"] = i % 2 === 0 ? "user" : "assistant";
    if (typeof item !== "object" || item === null) return { ok: false, error: "history items must be objects." };
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== expected) return { ok: false, error: "history must alternate user/assistant, starting with user." };
    if (typeof content !== "string" || content.length > MAX_HISTORY_MESSAGE_CHARS) {
      return { ok: false, error: `history content must be a string of at most ${MAX_HISTORY_MESSAGE_CHARS} characters.` };
    }
    turns.push({ role: expected, content: clean(content) });
  }
  if (turns.length % 2 !== 0) return { ok: false, error: "history must end with an assistant message." };

  return { ok: true, value: { question: q, history: turns } };
}

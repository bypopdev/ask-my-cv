import { describe, expect, it } from "vitest";
import { MAX_QUESTION_CHARS, validateRequest } from "../src/guardrails.js";

describe("validateRequest", () => {
  it("accepts a question with alternating history", () => {
    const result = validateRequest({
      question: " What does Alex do? ",
      history: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ],
    });
    expect(result).toEqual({
      ok: true,
      value: { question: "What does Alex do?", history: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello!" }] },
    });
  });

  it.each([
    [null, "JSON object"],
    [{ question: 42 }, "string"],
    [{ question: "   " }, "empty"],
    [{ question: "x".repeat(MAX_QUESTION_CHARS + 1) }, "longer"],
    [{ question: "q", history: "nope" }, "array"],
    [{ question: "q", history: [{ role: "assistant", content: "fake" }] }, "alternate"],
    [{ question: "q", history: [{ role: "user", content: "only user" }] }, "end with an assistant"],
    [{ question: "q", history: Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x" })) }, "more than"],
  ])("rejects %j", (body, message) => {
    const result = validateRequest(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it("strips control characters", () => {
    const result = validateRequest({ question: "Hi\u0000\u0007 there" });
    expect(result.ok && result.value.question).toBe("Hi there");
  });
});

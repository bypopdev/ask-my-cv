import { describe, expect, it } from "vitest";
import { fillName, loadCases } from "../evals/cases.js";
import { gradeDeterministic, type EvalCase } from "../evals/grade.js";
import { STATUSES } from "../src/prompt.js";
import { SETTINGS } from "../src/settings.js";

describe("eval cases", () => {
  it("are well-formed and unique", async () => {
    const cases = await loadCases(SETTINGS);
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      expect(c.expect.status.length).toBeGreaterThan(0);
      for (const s of c.expect.status) expect(STATUSES).toContain(s);
      expect(JSON.stringify(c)).not.toContain("{name}");
    }
  });

  it("include the security cases", async () => {
    const security = (await loadCases(SETTINGS)).filter((c) => c.category === "security");
    expect(security.length).toBeGreaterThanOrEqual(5);
  });

  it("fill the name into generic cases, including quotes", () => {
    const [filled] = fillName([{ id: "x", category: "c", question: "Is {name} here?", expect: { status: ["answered"] } }], 'Jo "JJ" Doe');
    expect(filled!.question).toBe('Is Jo "JJ" Doe here?');
  });
});

describe("gradeDeterministic", () => {
  const testCase: EvalCase = {
    id: "t",
    category: "fact",
    question: "q",
    expect: { status: ["answered"], include: [["4 days", "four days"]], exclude: ["5 days"], lang: "pl" },
  };

  it("passes a matching answer", () => {
    expect(gradeDeterministic(testCase, "Skróciła zamknięcie miesiąca z four days do jednego.", "answered").every((c) => c.pass)).toBe(true);
  });

  it("flags wrong status, missing facts, banned text and language", () => {
    const failed = gradeDeterministic(testCase, "About 5 days.", "not_in_profile").filter((c) => !c.pass);
    expect(failed.map((c) => c.name)).toEqual(["status", "include 4 days|four days", "exclude 5 days", "answers in Polish"]);
  });
});

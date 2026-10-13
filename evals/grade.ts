import type { Turn } from "../src/guardrails.js";

export interface EvalCase {
  id: string;
  category: string;
  question: string;
  history?: Turn[];
  expect: {
    status: string[];
    /** Every group must match; a group matches when any of its strings appears (case-insensitive). */
    include?: string[][];
    exclude?: string[];
    lang?: "pl";
  };
}

export interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

const POLISH = /[ąćęłńóśźż]/i;

/** Deterministic checks; the LLM judge (faithfulness) is added on top in run.ts. */
export function gradeDeterministic(testCase: EvalCase, answer: string, status: string): Check[] {
  const text = answer.toLowerCase();
  const checks: Check[] = [
    { name: "status", pass: testCase.expect.status.includes(status), detail: `got ${status}` },
  ];
  for (const group of testCase.expect.include ?? []) {
    checks.push({ name: `include ${group.join("|")}`, pass: group.some((s) => text.includes(s.toLowerCase())) });
  }
  for (const banned of testCase.expect.exclude ?? []) {
    checks.push({ name: `exclude ${banned}`, pass: !text.includes(banned.toLowerCase()) });
  }
  if (testCase.expect.lang === "pl") checks.push({ name: "answers in Polish", pass: POLISH.test(answer) });
  return checks;
}

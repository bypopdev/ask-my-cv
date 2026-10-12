import { describe, expect, it } from "vitest";
import { instructions } from "../src/prompt.js";
import { parseSettings } from "../src/settings.js";

const minimal = { name: "Jo Doe", contact: { label: "LinkedIn", url: "https://www.linkedin.com/in/jo" } };

describe("parseSettings", () => {
  it("fills defaults for optional fields", () => {
    expect(parseSettings(minimal)).toEqual({
      ...minimal,
      headline: "",
      links: [],
      languages: ["English"],
      confidential: "",
      suggestions: [],
      sourceUrl: "",
    });
  });

  it.each([
    [null, "JSON object"],
    [{ ...minimal, name: " " }, '"name"'],
    [{ ...minimal, contact: "x" }, '"contact"'],
    [{ ...minimal, contact: { label: "Site", url: "javascript:alert(1)" } }, "https://"],
    [{ ...minimal, links: {} }, '"links" must be an array'],
    [{ ...minimal, suggestions: [1] }, '"suggestions[0]"'],
  ])("rejects %j", (value, message) => {
    expect(() => parseSettings(value)).toThrow(message);
  });
});

describe("instructions", () => {
  it("names the person, the contact channel and the languages", () => {
    const text = instructions(parseSettings({ ...minimal, languages: ["English", "Polish"] }));
    expect(text).toContain("Jo Doe's personal website");
    expect(text).toContain("contacting Jo Doe on LinkedIn");
    expect(text).toContain("(English or Polish)");
  });

  it("adds the confidentiality rule only when it is configured", () => {
    expect(instructions(parseSettings(minimal))).not.toContain("deliberately high-level");
    expect(instructions(parseSettings({ ...minimal, confidential: "Acme's clients" }))).toContain("elaborate on Acme's clients");
  });
});

import { describe, expect, it } from "vitest";
import { PROFILE, sectionIds } from "../src/profile.js";
import { SETTINGS } from "../src/settings.js";

describe("profile", () => {
  it("declares unique section ids", () => {
    const ids = sectionIds();
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains no private contact data", () => {
    expect(PROFILE).not.toMatch(/\+48|\d{3}[ -]?\d{3}[ -]?\d{3}/);
    expect(PROFILE).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    expect(PROFILE).not.toMatch(/salary|wynagrodzen|brutto|PESEL/i);
  });

  it("comes with valid settings", () => {
    expect(SETTINGS.name.length).toBeGreaterThan(0);
    expect(SETTINGS.contact.url).toMatch(/^https:\/\//);
  });
});

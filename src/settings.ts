import raw from "../profile/assistant.json" with { type: "json" };

export interface Link {
  label: string;
  url: string;
}

/** Everything about the person that is not a CV fact: name, contact, page text, confidentiality rule. */
export interface Settings {
  name: string;
  headline: string;
  /** Where the assistant sends visitors for anything the profile does not cover. */
  contact: Link;
  links: Link[];
  /** Languages the assistant answers in; the first is the default. */
  languages: string[];
  /** Topics the assistant must not elaborate on, e.g. an employer's internal systems. Empty = no rule. */
  confidential: string;
  suggestions: string[];
  /** Link to the source code shown in the page footer. Empty = no link. */
  sourceUrl: string;
}

function str(value: unknown, field: string, required = true): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || (required && value.trim() === "")) throw new Error(`profile/assistant.json: "${field}" must be a non-empty string.`);
  return value.trim();
}

function link(value: unknown, field: string): Link {
  if (typeof value !== "object" || value === null) throw new Error(`profile/assistant.json: "${field}" must be an object with label and url.`);
  const { label, url } = value as Record<string, unknown>;
  const href = str(url, `${field}.url`);
  if (!/^(https:\/\/|mailto:)/.test(href)) throw new Error(`profile/assistant.json: "${field}.url" must start with https:// or mailto:.`);
  return { label: str(label, `${field}.label`), url: href };
}

function list<T>(value: unknown, field: string, item: (v: unknown, f: string) => T): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`profile/assistant.json: "${field}" must be an array.`);
  return value.map((v, i) => item(v, `${field}[${i}]`));
}

/** Validates the settings file so a typo fails at build time, not as a strange answer in production. */
export function parseSettings(value: unknown): Settings {
  if (typeof value !== "object" || value === null) throw new Error("profile/assistant.json must contain a JSON object.");
  const v = value as Record<string, unknown>;
  const languages = list(v.languages, "languages", (x, f) => str(x, f));
  return {
    name: str(v.name, "name"),
    headline: str(v.headline, "headline", false),
    contact: link(v.contact, "contact"),
    links: list(v.links, "links", link),
    languages: languages.length > 0 ? languages : ["English"],
    confidential: str(v.confidential, "confidential", false),
    suggestions: list(v.suggestions, "suggestions", (x, f) => str(x, f)),
    sourceUrl: str(v.sourceUrl, "sourceUrl", false),
  };
}

export const SETTINGS: Settings = parseSettings(raw);

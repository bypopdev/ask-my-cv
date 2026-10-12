import profile from "../profile/profile.md";

/** Section ids declared in the profile, e.g. "ledgerline.payouts". */
export function sectionIds(text: string = profile): string[] {
  return [...text.matchAll(/^## \[([a-z0-9.-]+)\]/gm)].map((m) => m[1]!);
}

export const PROFILE: string = profile;

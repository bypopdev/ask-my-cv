import { readFile } from "node:fs/promises";
import type { Settings } from "../src/settings.js";
import type { EvalCase } from "./grade.js";

/** Replaces {name} in the generic cases so they fit whoever the profile describes. */
export function fillName(cases: EvalCase[], name: string): EvalCase[] {
  return JSON.parse(JSON.stringify(cases).replaceAll("{name}", name.replaceAll('"', '\\"'))) as EvalCase[];
}

/** Generic security and privacy cases, then the cases that come with the profile. */
export async function loadCases(settings: Settings): Promise<EvalCase[]> {
  const read = async (url: URL) => JSON.parse(await readFile(url, "utf8")) as EvalCase[];
  const generic = await read(new URL("./generic.json", import.meta.url));
  const own = await read(new URL("../profile/evals.json", import.meta.url));
  return [...fillName(generic, settings.name), ...own];
}

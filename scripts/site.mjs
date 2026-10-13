// Renders the chat page from web/ and profile/assistant.json into dist/site/.
//   node scripts/site.mjs            page for deployment (Terraform writes config.js)
//   node scripts/site.mjs /api       page that calls a local API (used by npm run dev)
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const out = new URL("dist/site/", root);

const escape = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function renderPage(template, s) {
  const link = (l) => `<a href="${escape(l.url)}" rel="noopener">${escape(l.label)}</a>`;
  const initials = s.name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const languages = s.languages?.length ? s.languages : ["English"];
  const values = {
    name: escape(s.name),
    initials: escape(initials),
    headline: escape(s.headline ?? ""),
    links: [s.contact, ...(s.links ?? [])].map(link).join(" · "),
    languages: escape(languages.length > 1 ? `${languages.slice(0, -1).join(", ")} or ${languages.at(-1)}` : languages[0]),
    suggestions: (s.suggestions ?? []).map((q) => `<button type="button">${escape(q)}</button>`).join("\n      "),
    contactUrl: escape(s.contact.url),
    contactLabel: escape(s.contact.label),
    source: s.sourceUrl ? ` <a href="${escape(s.sourceUrl)}" rel="noopener">Source code</a>.` : "",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in values ? values[key] : match));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const settings = JSON.parse(await readFile(new URL("profile/assistant.json", root), "utf8"));
  const template = await readFile(new URL("web/index.html", root), "utf8");
  await mkdir(out, { recursive: true });
  await writeFile(new URL("index.html", out), renderPage(template, settings));
  for (const file of ["app.js", "styles.css"]) await copyFile(new URL(`web/${file}`, root), new URL(file, out));
  const api = process.argv[2] ?? "";
  await writeFile(new URL("config.js", out), `// Overwritten at deploy time with the Lambda Function URL.\nwindow.ASK_MY_CV_API = ${JSON.stringify(api)};\n`);
  console.log("built dist/site/");
}

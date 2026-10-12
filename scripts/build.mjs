import { build } from "esbuild";

await build({
  entryPoints: ["src/handler.ts"],
  outfile: "dist/handler.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  minify: true,
  sourcemap: true,
  loader: { ".md": "text" },
  // Some bundled CommonJS dependencies call require(); give ESM output a real one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
console.log("built dist/handler.mjs");

/**
 * Copies the Job Scout library into the job-scout Edge Function, so the
 * scheduled scans run exactly the code the app runs.
 *
 *   node scripts/build-scout-function.mjs
 *
 * Follows relative imports from the files the function uses and copies
 * each into supabase/functions/job-scout/scout/. Run it after changing
 * anything in src/lib/scout, then redeploy the function
 * (`supabase functions deploy job-scout --no-verify-jwt`).
 */
import fs from "node:fs";
import path from "node:path";

const SRC = "src/lib/scout";
const OUT = "supabase/functions/job-scout/scout";
const ENTRY = ["supabase-store.ts", "jobposting.ts"];

const seen = new Set();
const queue = [...ENTRY];
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const text = fs.readFileSync(path.join(SRC, file), "utf8");
  for (const m of text.matchAll(/from\s+["']\.\/([\w.-]+)["']/g)) {
    const dep = m[1].endsWith(".ts") ? m[1] : `${m[1]}.ts`;
    if (!m[1].endsWith(".ts"))
      throw new Error(`${file} imports "./${m[1]}" without .ts; Deno needs the extension`);
    queue.push(dep);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// Bare package imports become npm: specifiers for Deno.
const NPM = { zod: "npm:zod@4.6.2" };

for (const file of [...seen].sort()) {
  let text = fs.readFileSync(path.join(SRC, file), "utf8");
  for (const [pkg, spec] of Object.entries(NPM))
    text = text.replace(new RegExp(`from "${pkg}"`, "g"), `from "${spec}"`);
  fs.writeFileSync(
    path.join(OUT, file),
    `// Generated from src/lib/scout/${file} by scripts/build-scout-function.mjs. Do not edit.\n${text}`,
  );
}
console.log(`Copied ${seen.size} files to ${OUT}: ${[...seen].sort().join(", ")}`);

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { stagingSettings, workerConfig, liveRefs } from './staging-config.mjs';

const settings = stagingSettings(JSON.parse(await readFile('staging.settings.local.json', 'utf8')));
const execute = (script, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', env, windowsHide: true });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve() : reject(new Error(`Command failed (${code})`)));
});
const env = { ...process.env, VITE_SUPABASE_URL: settings.url, VITE_SUPABASE_PUBLISHABLE_KEY: settings.publishableKey, SUPABASE_URL: settings.url, SUPABASE_PUBLISHABLE_KEY: settings.publishableKey, SAVANT_ENV: 'staging' };
// Production server credentials must never be available to a staging build.
for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY', 'SCOUT_CRON_SECRET', 'JOBSPY_TOKEN']) delete env[key];
await execute('node_modules/vite/bin/vite.js', ['build', '--mode', 'staging'], env);
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    result.push(...(entry.isDirectory() ? await files(name) : [name]));
  }
  return result;
}
const outputFiles = await files('.output');
const generatedFile = outputFiles.find(f => /[/\\]wrangler\.json$/.test(f));
if (!generatedFile) throw new Error('Nitro did not generate a wrangler.json; staging deployment stopped');
const generated = JSON.parse(await readFile(generatedFile, 'utf8'));
const config = workerConfig(generated, settings, path.dirname(path.resolve(generatedFile)));
const configFile = path.resolve('.output/wrangler.staging.json');
await writeFile(configFile, JSON.stringify(config, null, 2));
for (const file of outputFiles.filter(f => /\.(m?js|html)$/.test(f))) {
  const content = await readFile(file, 'utf8');
  if (liveRefs.some(ref => content.includes(ref))) throw new Error(`Production Supabase reference found in ${file}; staging deployment stopped`);
}
if (process.argv.includes('--deploy')) {
  // Require a freshly generated staging config; never invoke the production deploy script.
  await execute('node_modules/wrangler/bin/wrangler.js', ['deploy', '--config', configFile], { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' });
} else {
  await execute('node_modules/wrangler/bin/wrangler.js', ['deploy', '--config', configFile, '--dry-run', '--outdir', '.output/staging-dry-run'], { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' });
}

import path from 'node:path';
export const liveRefs = ['auldwzcqtjpwmliqqoyj', 'tohslisvzeliehezgnod'];
export function stagingSettings(value) {
  const { projectRef, publishableKey, accountId } = value;
  if (!/^[a-z]{20}$/.test(projectRef || '') || liveRefs.includes(projectRef)) throw new Error('Staging requires a separate Supabase project reference');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey || '')) throw new Error('Use the staging project publishable key, never a service-role key');
  if (!/^[a-f0-9]{32}$/.test(accountId || '')) throw new Error('Cloudflare accountId required');
  return { projectRef, publishableKey, accountId, url: `https://${projectRef}.supabase.co` };
}
export function workerConfig(generated, settings, outputDir) {
  // Explicit construction prevents production routes, vars, schedules and bindings from leaking in.
  return {
    name: 'savantalent-staging', account_id: settings.accountId,
    main: path.resolve(outputDir, generated.main),
    no_bundle: true,
    rules: generated.rules || [{ type: 'ESModule', globs: ['**/*.mjs', '**/*.js'] }],
    compatibility_date: generated.compatibility_date || '2026-10-01',
    compatibility_flags: ['nodejs_compat'], workers_dev: true, routes: [],
    ...(generated.assets ? { assets: { ...generated.assets, directory: path.resolve(outputDir, generated.assets.directory) } } : {}),
    observability: { enabled: true },
    vars: { SAVANT_ENV: 'staging', SUPABASE_URL: settings.url, SUPABASE_PUBLISHABLE_KEY: settings.publishableKey, CONTACT_NOTIFY_TO: 'nobody@example.invalid', RESEND_FROM: 'Savant Staging <nobody@example.invalid>' },
  };
}

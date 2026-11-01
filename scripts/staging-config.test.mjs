import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stagingSettings, workerConfig, liveRefs } from './staging-config.mjs';
const valid = { projectRef: 'abcdefghijklmnopqrst', publishableKey: 'sb_publishable_test', accountId: 'a'.repeat(32) };
test('staging rejects both existing Savant databases and private keys', () => {
  for (const projectRef of liveRefs) assert.throws(() => stagingSettings({ ...valid, projectRef }));
  assert.throws(() => stagingSettings({ ...valid, publishableKey: 'sb_secret_private' }));
});
test('staging config drops production domains, bindings, secrets and cron', () => {
  const config = workerConfig({ main: 'index.mjs', assets: { directory: '../public', binding: 'ASSETS' }, routes: ['savantalent.com'], vars: { RESEND_API_KEY: 'private' }, triggers: { crons: ['* * * * *'] } }, stagingSettings(valid), '/build/server');
  assert.equal(config.name, 'savantalent-staging');
  assert.deepEqual(config.routes, []);
  assert.equal(config.vars.SUPABASE_URL, 'https://abcdefghijklmnopqrst.supabase.co');
  assert.equal(config.vars.RESEND_API_KEY, undefined);
  assert.equal(config.triggers, undefined);
  assert.equal(config.assets.binding, 'ASSETS');
});

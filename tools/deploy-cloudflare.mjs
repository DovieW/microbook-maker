// Default is a dry run. Requires the new cf CLI and refuses a paid Workers account.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const args = process.argv.slice(2);
assert.ok(
  args.every((arg) => arg === '--deploy'),
  'Usage: node tools/deploy-cloudflare.mjs [--deploy]',
);
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
assert.match(account || '', /^[a-f0-9]{32}$/, 'Set CLOUDFLARE_ACCOUNT_ID explicitly');
const subscriptions = JSON.parse(
  execFileSync('cf', ['accounts', 'subscriptions', 'get'], { encoding: 'utf8' }),
);
assert.ok(Array.isArray(subscriptions), 'Cannot verify Cloudflare subscriptions; refusing deployment');
assert.ok(
  !subscriptions.some((s) =>
    /workers|browser.?run|browser.?rendering/i.test(
      `${s.product?.name} ${s.product?.public_name} ${s.rate_plan?.id} ${s.rate_plan?.public_name}`,
    ),
  ),
  'A Workers/browser subscription exists. This deployment only supports the verified Free account configuration. No billing changes were made.',
);
console.log('Free-account guard passed. No subscriptions or billable storage will be provisioned.');
execFileSync(process.execPath, ['tools/build-cloudflare.mjs'], { stdio: 'inherit' });
const deployArgs = ['deploy', '--prebuilt'];
if (process.env.MICROBOOK_CLOUDFLARE_SECRETS_FILE)
  deployArgs.push('--secrets-file', process.env.MICROBOOK_CLOUDFLARE_SECRETS_FILE);
execFileSync('cf', [...deployArgs, '--dry-run'], { stdio: 'inherit' });
if (args.includes('--deploy')) execFileSync('cf', deployArgs, { stdio: 'inherit' });

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Run tests in an isolated test directory
const testDataDir = path.join(os.tmpdir(), `autoclip_lic_test_${Date.now()}`);
fs.mkdirSync(testDataDir, { recursive: true });
process.env.AUTOCLIP_DATA_DIR = testDataDir;

// Re-require modules with testDataDir
delete require.cache[require.resolve('../lib/config')];
delete require.cache[require.resolve('../lib/licensing')];

const {
  loadLicenseSync,
  getLicenseStatus,
  canExportClips,
  recordClipsExported,
  generateKey,
  verifyKey,
  activateLicenseKey,
  WEEKLY_LIMIT,
  TRIAL_DAYS
} = require('../lib/licensing');

test('Licensing: initializes with 30-day Free Pass and 100 weekly clips limit', () => {
  const status = getLicenseStatus();
  assert.strictEqual(status.tier, 'free_trial');
  assert.strictEqual(status.status, 'active');
  assert.strictEqual(status.weeklyLimit, 100);
  assert.ok(status.trialDaysRemaining > 0 && status.trialDaysRemaining <= 30);
  assert.strictEqual(status.isMax, false);
});

test('Licensing: canExportClips allows exports within 100 limit', () => {
  const check = canExportClips(5);
  assert.strictEqual(check.allowed, true);
  assert.strictEqual(check.tier, 'free_trial');
});

test('Licensing: canExportClips rejects when requesting more than weekly limit', () => {
  const check = canExportClips(105);
  assert.strictEqual(check.allowed, false);
  assert.strictEqual(check.reason, 'weekly_quota_exceeded');
});

test('Licensing: generates and verifies 1-year signed key', () => {
  const keyInfo = generateKey('Tester', '1year');
  assert.ok(keyInfo.key.startsWith('ACMAX-TESTER-'));
  const verify = verifyKey(keyInfo.key);
  assert.strictEqual(verify.valid, true);
  assert.strictEqual(verify.holder, 'TESTER');
  assert.strictEqual(verify.isLifetime, false);
  assert.ok(verify.expiresAt > Date.now());
});

test('Licensing: generates and verifies lifetime signed key', () => {
  const keyInfo = generateKey('Founder', 'lifetime');
  assert.ok(keyInfo.key.startsWith('ACMAX-FOUNDER-LIFE-'));
  const verify = verifyKey(keyInfo.key);
  assert.strictEqual(verify.valid, true);
  assert.strictEqual(verify.holder, 'FOUNDER');
  assert.strictEqual(verify.isLifetime, true);
  assert.strictEqual(verify.expiresAt, null);
});

test('Licensing: rejects fake or tampered key', () => {
  const fakeKey = 'ACMAX-HACKER-LIFE-000000000000';
  const verify = verifyKey(fakeKey);
  assert.strictEqual(verify.valid, false);
  assert.strictEqual(verify.error, 'Invalid license key signature.');
});

test('Licensing: activates key and unlocks Max tier permanently', async () => {
  const keyInfo = generateKey('VipFriend', 'lifetime');
  const result = await activateLicenseKey(keyInfo.key);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.license.tier, 'max');
  assert.strictEqual(result.license.isMax, true);
  assert.strictEqual(result.license.isLifetime, true);

  // Once Max tier, canExportClips allows unlimited exports
  const exportCheck = canExportClips(500);
  assert.strictEqual(exportCheck.allowed, true);
  assert.strictEqual(exportCheck.unlimited, true);

  // Cleanup temp dir
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch (_) {}
});

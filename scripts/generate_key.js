#!/usr/bin/env node

/**
 * AUTOCLIPIN License Key Generator
 * Usage:
 *   node scripts/generate_key.js --tier max --name "Yash"        ($20 / mo  - 1,200 clips)
 *   node scripts/generate_key.js --tier ultra --name "Alex"      ($50 / mo  - Unlimited clips)
 *   node scripts/generate_key.js --tier yearly --name "VIP"      ($200 / yr - Unlimited clips for 1 Year)
 *   node scripts/generate_key.js --lifetime --name "Partner"     (Lifetime Unlimited)
 */

const { generateKey, verifyKey } = require('../lib/licensing');

const args = process.argv.slice(2);

let name = 'VIP';
let tier = 'max';
let duration = '1month';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name' && args[i + 1]) {
    name = args[++i];
  } else if (args[i] === '--tier' && args[i + 1]) {
    tier = args[++i].toLowerCase();
    if (tier === 'yearly') duration = '1year';
  } else if (args[i] === '--lifetime') {
    tier = 'ultra';
    duration = 'lifetime';
  } else if (args[i] === '--duration' && args[i + 1]) {
    duration = args[++i];
  } else if (!args[i].startsWith('--')) {
    name = args[i];
  }
}

const keyInfo = generateKey(name, tier, duration);
const testVerify = verifyKey(keyInfo.key);

console.log('\n======================================================');
console.log('       👑 AUTOCLIPIN OFFICIAL LICENSE KEY GENERATOR   ');
console.log('======================================================\n');
console.log(`  Holder Name : ${keyInfo.holder}`);
console.log(`  Tier Plan   : ${keyInfo.tierName} (${tier.toUpperCase()})`);
console.log(`  Duration    : ${duration === 'lifetime' ? 'Lifetime (Permanent Access)' : (duration === '1year' ? '1 Year Full Access' : '1 Month Subscription')}`);
if (keyInfo.expiresAt) {
  console.log(`  Expires On  : ${new Date(keyInfo.expiresAt).toLocaleDateString()}`);
}
console.log(`\n  🔑 ACTIVATION KEY:\n`);
console.log(`     \x1b[32m\x1b[1m${keyInfo.key}\x1b[0m\n`);
console.log('------------------------------------------------------');
console.log(`  Verification test: ${testVerify.valid ? '✅ VALID & READY TO DISTRIBUTE' : '❌ FAILED'}`);
console.log('======================================================\n');

#!/usr/bin/env node

/**
 * AutoClip VIP & Yearly License Key Generator
 * Usage:
 *   node scripts/generate_key.js --name "Alex" --duration 1year
 *   node scripts/generate_key.js --name "Creator" --lifetime
 *   node scripts/generate_key.js "BestFriend"
 */

const { generateKey, verifyKey } = require('../lib/licensing');

const args = process.argv.slice(2);

let name = 'VIP';
let duration = '1year';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name' && args[i + 1]) {
    name = args[++i];
  } else if (args[i] === '--lifetime') {
    duration = 'lifetime';
  } else if (args[i] === '--duration' && args[i + 1]) {
    duration = args[++i];
  } else if (!args[i].startsWith('--')) {
    name = args[i];
  }
}

const keyInfo = generateKey(name, duration);
const testVerify = verifyKey(keyInfo.key);

console.log('\n======================================================');
console.log('       👑 AUTOCLIP MAX VIP LICENSE KEY GENERATOR      ');
console.log('======================================================\n');
console.log(`  Holder Name : ${keyInfo.holder}`);
console.log(`  Duration    : ${duration === 'lifetime' ? 'Lifetime (Permanent Free Access)' : '1 Year Full Access'}`);
if (keyInfo.expiresAt) {
  console.log(`  Expires On  : ${new Date(keyInfo.expiresAt).toLocaleDateString()}`);
}
console.log(`\n  🔑 ACTIVATION KEY:\n`);
console.log(`     \x1b[32m\x1b[1m${keyInfo.key}\x1b[0m\n`);
console.log('------------------------------------------------------');
console.log(`  Verification test: ${testVerify.valid ? '✅ VALID & READY TO DISTRIBUTE' : '❌ FAILED'}`);
console.log('======================================================\n');

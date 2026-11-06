const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { DATA } = require('./config');

const LICENSE_FILE = path.join(DATA, 'license.json');
const SECRET_SALT = process.env.AUTOCLIP_LICENSE_SALT || 'AUTOCLIP_OFFLINE_SECRET_SALT_2026_MAX_VIP';

const WEEKLY_LIMIT = 100;
const TRIAL_DAYS = 30;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

// Pricing & Quota Definitions - 100% FREE FOR ALL CREATORS
const TIERS = {
  free_trial: { id: 'free_trial', name: '100% Free Creator Edition', price: 0, clipLimit: 999999, interval: 'permanent', unlimited: true },
  unlimited_free: { id: 'unlimited_free', name: '100% Free Creator Edition', price: 0, clipLimit: 999999, interval: 'permanent', unlimited: true },
  max: { id: 'max', name: 'AUTOCLIPIN Unlimited', price: 0, clipLimit: 999999, interval: 'permanent', unlimited: true },
  ultra: { id: 'ultra', name: 'AUTOCLIPIN Unlimited', price: 0, clipLimit: 999999, interval: 'permanent', unlimited: true },
  yearly: { id: 'yearly', name: 'AUTOCLIPIN Unlimited', price: 0, clipLimit: 999999, interval: 'permanent', unlimited: true }
};

let _cachedLicense = null;

/**
 * Load license from disk or initialize default 100% Free Unlimited Pass
 */
function loadLicenseSync() {
  if (!fs.existsSync(LICENSE_FILE)) {
    _cachedLicense = null;
  } else if (_cachedLicense) {
    refreshWeeklyQuota(_cachedLicense);
    return _cachedLicense;
  }

  if (fs.existsSync(LICENSE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
      data.tier = 'unlimited_free';
      data.status = 'active';
      data.weeklyLimit = 999999;
      data.monthlyLimit = 999999;
      data.trialExpiresAt = null;
      data.keyExpiresAt = null;
      refreshWeeklyQuota(data);
      _cachedLicense = data;
      return _cachedLicense;
    } catch (err) {
      console.warn('[Licensing] Error reading license.json, resetting to default:', err.message);
    }
  }

  // Default license: 100% Free Forever with Unlimited Clips
  const now = Date.now();
  const defaultLicense = {
    tier: 'unlimited_free',
    status: 'active',
    holder: 'Creator (Free Forever)',
    createdAt: now,
    trialExpiresAt: null,
    weeklyPeriodStart: now,
    clipsExportedThisWeek: 0,
    weeklyLimit: 999999,
    monthlyLimit: 999999,
    totalClipsExported: 0,
    licenseKey: 'FREE-COMMUNITY-EDITION',
    keyExpiresAt: null,
    activatedAt: now
  };

  try {
    fs.mkdirSync(path.dirname(LICENSE_FILE), { recursive: true });
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(defaultLicense, null, 2), 'utf8');
  } catch (e) {
    console.error('[Licensing] Failed to write initial license.json:', e.message);
  }

  _cachedLicense = defaultLicense;
  return _cachedLicense;
}

/**
 * Check and advance the rolling quota windows
 */
function refreshWeeklyQuota(license) {
  if (!license) return;

  const now = Date.now();
  if (license.weeklyPeriodStart) {
    const elapsed = now - license.weeklyPeriodStart;
    if (elapsed >= SEVEN_DAYS_MS) {
      const weeksPassed = Math.floor(elapsed / SEVEN_DAYS_MS);
      license.weeklyPeriodStart += weeksPassed * SEVEN_DAYS_MS;
      license.clipsExportedThisWeek = 0;
      saveLicenseSync(license);
    }
  }

  // Monthly quota refresh for Max plan (1200 clips/month)
  if (license.tier === 'max') {
    if (!license.monthlyPeriodStart) license.monthlyPeriodStart = license.activatedAt || now;
    const elapsedMonth = now - license.monthlyPeriodStart;
    if (elapsedMonth >= THIRTY_DAYS_MS) {
      const monthsPassed = Math.floor(elapsedMonth / THIRTY_DAYS_MS);
      license.monthlyPeriodStart += monthsPassed * THIRTY_DAYS_MS;
      license.clipsExportedThisMonth = 0;
      saveLicenseSync(license);
    }
  }

  // Check expiration
  if (license.tier === 'free_trial' && now > license.trialExpiresAt) {
    license.status = 'expired';
  } else if (license.keyExpiresAt && now > license.keyExpiresAt) {
    license.status = 'expired';
  } else {
    license.status = 'active';
  }
}

function saveLicenseSync(license) {
  try {
    fs.mkdirSync(path.dirname(LICENSE_FILE), { recursive: true });
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(license, null, 2), 'utf8');
    _cachedLicense = license;
  } catch (err) {
    console.error('[Licensing] Failed to save license.json:', err.message);
  }
}

async function saveLicense(license) {
  try {
    await fsp.mkdir(path.dirname(LICENSE_FILE), { recursive: true });
    await fsp.writeFile(LICENSE_FILE, JSON.stringify(license, null, 2), 'utf8');
    _cachedLicense = license;
  } catch (err) {
    console.error('[Licensing] Failed to save license.json:', err.message);
  }
}

/**
 * Get sanitized client-friendly license status - 100% Free Unlimited
 */
function getLicenseStatus() {
  const license = loadLicenseSync();

  return {
    tier: 'unlimited_free',
    tierName: '100% Free Creator Edition',
    isPro: true,
    isMax: true,
    isUnlimited: true,
    isExpired: false,
    status: 'active',
    holder: license.holder || 'Creator (Free Forever)',
    weeklyLimit: 999999,
    monthlyLimit: 999999,
    clipsExportedThisWeek: license.clipsExportedThisWeek || 0,
    clipsExportedThisMonth: license.clipsExportedThisMonth || 0,
    clipsRemaining: 999999,
    clipsRemainingThisWeek: 999999,
    totalClipsExported: license.totalClipsExported || 0,
    trialDaysRemaining: 99999,
    trialExpiresAt: null,
    daysUntilWeeklyReset: 365,
    msUntilWeeklyReset: 365 * 24 * 60 * 60 * 1000,
    licenseKey: 'FREE-COMMUNITY-EDITION',
    keyExpiresAt: null,
    isLifetime: true,
    tiers: TIERS
  };
}

/**
 * Check if the user is authorized to export N clips right now - Always allowed!
 */
function canExportClips(count = 1) {
  return {
    allowed: true,
    tier: 'unlimited_free',
    unlimited: true
  };
}

/**
 * Record successful clip exports
 */
async function recordClipsExported(count = 1) {
  const license = loadLicenseSync();
  license.clipsExportedThisWeek = (license.clipsExportedThisWeek || 0) + count;
  license.clipsExportedThisMonth = (license.clipsExportedThisMonth || 0) + count;
  license.totalClipsExported = (license.totalClipsExported || 0) + count;
  await saveLicense(license);
  return getLicenseStatus();
}

/**
 * Generate a cryptographically signed VIP Key
 * Supported Tiers:
 *   - 'max'    ($20/mo  - 1,200 clips/mo) -> Prefix: ACMAX
 *   - 'ultra'  ($50/mo  - Unlimited clips) -> Prefix: ACULTRA
 *   - 'yearly' ($200/yr - Unlimited clips) -> Prefix: ACYEAR
 * Formats: <PREFIX>-<NAME>-<EXP_FLAG>-<HMAC12>
 */
function generateKey(name = 'VIP', tier = 'max', duration = '1month') {
  const cleanName = String(name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'VIP';
  
  let prefix = 'ACMAX';
  if (tier === 'ultra') prefix = 'ACULTRA';
  else if (tier === 'yearly') prefix = 'ACYEAR';
  
  let expFlag;
  let expiresAt = null;

  if (duration === 'lifetime') {
    expFlag = 'LIFE';
  } else if (duration === '1year' || tier === 'yearly') {
    const oneYearLater = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const epochDays = Math.floor(oneYearLater / (24 * 60 * 60 * 1000));
    expFlag = `D${epochDays}`;
    expiresAt = oneYearLater;
  } else {
    // 30 days (standard 1 month subscription)
    const oneMonthLater = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const epochDays = Math.floor(oneMonthLater / (24 * 60 * 60 * 1000));
    expFlag = `D${epochDays}`;
    expiresAt = oneMonthLater;
  }

  const payload = `${prefix}:${cleanName}:${expFlag}`;
  const hmac = crypto.createHmac('sha256', SECRET_SALT)
    .update(payload)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  const formattedKey = `${prefix}-${cleanName}-${expFlag}-${hmac}`;

  return {
    key: formattedKey,
    holder: name,
    tier,
    tierName: TIERS[tier]?.name || 'AUTOCLIPIN Pass',
    duration,
    expiresAt,
    isLifetime: duration === 'lifetime'
  };
}

/**
 * Verify an offline cryptographic VIP Key
 */
function verifyKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') {
    return { valid: false, error: 'Key is required.' };
  }

  const trimmed = rawKey.trim().toUpperCase();
  const parts = trimmed.split('-');

  if (parts.length !== 4) {
    return { valid: false, error: 'Invalid key format. Expected: ACMAX-NAME-EXPDATE-XXXX' };
  }

  const [prefix, nameSlug, expFlag, hmacReceived] = parts;
  let tier = 'max';
  if (prefix === 'ACULTRA') tier = 'ultra';
  else if (prefix === 'ACYEAR') tier = 'yearly';
  else if (prefix !== 'ACMAX') {
    return { valid: false, error: 'Unrecognized license prefix.' };
  }

  // Backwards compatibility payload vs new prefixed payload
  const newPayload = `${prefix}:${nameSlug}:${expFlag}`;
  const legacyPayload = `${nameSlug}:${expFlag}`;

  const expectedNewHmac = crypto.createHmac('sha256', SECRET_SALT)
    .update(newPayload)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  const expectedLegacyHmac = crypto.createHmac('sha256', SECRET_SALT)
    .update(legacyPayload)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  if (hmacReceived !== expectedNewHmac && hmacReceived !== expectedLegacyHmac) {
    return { valid: false, error: 'Invalid license key signature.' };
  }

  let expiresAt = null;
  if (expFlag !== 'LIFE') {
    if (!expFlag.startsWith('D')) {
      return { valid: false, error: 'Invalid expiration timestamp in key.' };
    }
    const epochDays = parseInt(expFlag.slice(1), 10);
    if (isNaN(epochDays)) {
      return { valid: false, error: 'Malformed expiration flag.' };
    }
    expiresAt = epochDays * 24 * 60 * 60 * 1000;

    if (Date.now() > expiresAt) {
      return { valid: false, error: 'This license key has expired.' };
    }
  }

  return {
    valid: true,
    tier,
    tierName: TIERS[tier]?.name || 'AUTOCLIPIN Plan',
    holder: nameSlug,
    expiresAt,
    isLifetime: expFlag === 'LIFE'
  };
}

/**
 * Activate a license key and upgrade the user
 */
async function activateLicenseKey(rawKey) {
  const result = verifyKey(rawKey);
  if (!result.valid) {
    return { success: false, error: result.error };
  }

  const license = loadLicenseSync();
  license.tier = result.tier;
  license.status = 'active';
  license.holder = result.holder;
  license.licenseKey = rawKey.trim();
  license.keyExpiresAt = result.expiresAt;
  license.activatedAt = Date.now();
  license.clipsExportedThisMonth = 0;

  await saveLicense(license);

  const durationStr = result.isLifetime 
    ? 'Lifetime VIP access' 
    : (result.expiresAt ? `Active through ${new Date(result.expiresAt).toLocaleDateString()}` : 'Active');

  return {
    success: true,
    message: `🎉 ${result.tierName} Activated! ${durationStr} unlocked for ${result.holder}.`,
    license: getLicenseStatus()
  };
}

module.exports = {
  loadLicenseSync,
  getLicenseStatus,
  canExportClips,
  recordClipsExported,
  generateKey,
  verifyKey,
  activateLicenseKey,
  LICENSE_FILE,
  WEEKLY_LIMIT,
  TRIAL_DAYS
};

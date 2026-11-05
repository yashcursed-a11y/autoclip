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
const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

let _cachedLicense = null;

/**
 * Load license from disk or initialize default 30-day Free Pass
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
      refreshWeeklyQuota(data);
      _cachedLicense = data;
      return _cachedLicense;
    } catch (err) {
      console.warn('[Licensing] Error reading license.json, resetting to default:', err.message);
    }
  }

  // First launch default license: 30-Day Free Pass with 100 clips/week
  const now = Date.now();
  const defaultLicense = {
    tier: 'free_trial', // 'free_trial' | 'max'
    status: 'active',    // 'active' | 'expired'
    holder: 'Creator',
    createdAt: now,
    trialExpiresAt: now + TRIAL_DURATION_MS,
    weeklyPeriodStart: now,
    clipsExportedThisWeek: 0,
    weeklyLimit: WEEKLY_LIMIT,
    totalClipsExported: 0,
    licenseKey: null,
    keyExpiresAt: null,
    activatedAt: null
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
 * Check and advance the 7-day rolling window if a week has passed
 */
function refreshWeeklyQuota(license) {
  if (!license || !license.weeklyPeriodStart) return;

  const now = Date.now();
  const elapsed = now - license.weeklyPeriodStart;

  if (elapsed >= SEVEN_DAYS_MS) {
    const weeksPassed = Math.floor(elapsed / SEVEN_DAYS_MS);
    license.weeklyPeriodStart += weeksPassed * SEVEN_DAYS_MS;
    license.clipsExportedThisWeek = 0;
    saveLicenseSync(license);
  }

  // Check trial expiration
  if (license.tier === 'free_trial' && now > license.trialExpiresAt) {
    license.status = 'expired';
  } else if (license.tier === 'max' && license.keyExpiresAt && now > license.keyExpiresAt) {
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
 * Get sanitized client-friendly license status
 */
function getLicenseStatus() {
  const license = loadLicenseSync();
  const now = Date.now();

  const isMax = license.tier === 'max' && license.status === 'active';
  const isExpired = license.status === 'expired';

  const trialDaysRemaining = license.trialExpiresAt 
    ? Math.max(0, Math.ceil((license.trialExpiresAt - now) / (24 * 60 * 60 * 1000)))
    : 0;

  const msUntilWeeklyReset = Math.max(0, (license.weeklyPeriodStart + SEVEN_DAYS_MS) - now);
  const daysUntilWeeklyReset = Math.ceil(msUntilWeeklyReset / (24 * 60 * 60 * 1000));

  return {
    tier: license.tier,
    isMax,
    isExpired,
    status: license.status,
    holder: license.holder || 'Creator',
    weeklyLimit: license.weeklyLimit || WEEKLY_LIMIT,
    clipsExportedThisWeek: license.clipsExportedThisWeek || 0,
    clipsRemainingThisWeek: isMax ? 999999 : Math.max(0, (license.weeklyLimit || WEEKLY_LIMIT) - (license.clipsExportedThisWeek || 0)),
    totalClipsExported: license.totalClipsExported || 0,
    trialDaysRemaining,
    trialExpiresAt: license.trialExpiresAt,
    daysUntilWeeklyReset,
    msUntilWeeklyReset,
    licenseKey: license.licenseKey ? `${license.licenseKey.slice(0, 10)}...` : null,
    keyExpiresAt: license.keyExpiresAt,
    isLifetime: isMax && !license.keyExpiresAt
  };
}

/**
 * Check if the user is authorized to export N clips right now
 */
function canExportClips(count = 1) {
  const license = loadLicenseSync();
  const now = Date.now();

  // 1. Check Max Tier
  if (license.tier === 'max') {
    if (license.keyExpiresAt && now > license.keyExpiresAt) {
      return {
        allowed: false,
        reason: 'key_expired',
        message: 'Your AutoClip Max license has expired. Please renew your yearly access or enter a new VIP key to continue exporting.'
      };
    }
    return {
      allowed: true,
      tier: 'max',
      unlimited: true
    };
  }

  // 2. Check 30-Day Free Pass Expiration
  if (now > license.trialExpiresAt) {
    return {
      allowed: false,
      reason: 'trial_expired',
      message: 'Your 30-day Free Pass has ended! Upgrade to AutoClip Max (Yearly Access) or enter an activation key to continue exporting.'
    };
  }

  // 3. Check 100 Clips / Week Limit
  const currentWeekUsed = license.clipsExportedThisWeek || 0;
  const limit = license.weeklyLimit || WEEKLY_LIMIT;

  if (currentWeekUsed + count > limit) {
    const msUntilReset = Math.max(0, (license.weeklyPeriodStart + SEVEN_DAYS_MS) - now);
    const daysUntilReset = Math.ceil(msUntilReset / (24 * 60 * 60 * 1000));
    return {
      allowed: false,
      reason: 'weekly_quota_exceeded',
      message: `Weekly limit reached! You have exported ${currentWeekUsed}/${limit} clips this week. Your quota resets in ${daysUntilReset} day(s). Upgrade to AutoClip Max for unlimited exports!`,
      currentWeekUsed,
      limit,
      daysUntilReset
    };
  }

  return {
    allowed: true,
    tier: 'free_trial',
    remainingThisWeek: limit - (currentWeekUsed + count)
  };
}

/**
 * Record successful clip exports
 */
async function recordClipsExported(count = 1) {
  const license = loadLicenseSync();
  license.clipsExportedThisWeek = (license.clipsExportedThisWeek || 0) + count;
  license.totalClipsExported = (license.totalClipsExported || 0) + count;
  await saveLicense(license);
  return getLicenseStatus();
}

/**
 * Generate a cryptographically signed VIP Key
 * Format: ACMAX-<NAME_SLUG>-<EXP_FLAG>-<HMAC12>
 */
function generateKey(name = 'VIP', duration = '1year') {
  const cleanName = String(name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'VIP';
  
  let expFlag;
  let expiresAt = null;

  if (duration === 'lifetime') {
    expFlag = 'LIFE';
  } else {
    // 1 year from now (in days since epoch for compact format)
    const oneYearLater = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const epochDays = Math.floor(oneYearLater / (24 * 60 * 60 * 1000));
    expFlag = `D${epochDays}`;
    expiresAt = oneYearLater;
  }

  const payload = `${cleanName}:${expFlag}`;
  const hmac = crypto.createHmac('sha256', SECRET_SALT)
    .update(payload)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  const formattedKey = `ACMAX-${cleanName}-${expFlag}-${hmac}`;

  return {
    key: formattedKey,
    holder: name,
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

  if (parts.length !== 4 || parts[0] !== 'ACMAX') {
    return { valid: false, error: 'Invalid key format. Expected format: ACMAX-NAME-EXPDATE-XXXX' };
  }

  const [, nameSlug, expFlag, hmacReceived] = parts;
  const payload = `${nameSlug}:${expFlag}`;

  const expectedHmac = crypto.createHmac('sha256', SECRET_SALT)
    .update(payload)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  if (hmacReceived !== expectedHmac) {
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
    holder: nameSlug,
    expiresAt,
    isLifetime: expFlag === 'LIFE'
  };
}

/**
 * Activate a license key and upgrade the user to AutoClip Max
 */
async function activateLicenseKey(rawKey) {
  const result = verifyKey(rawKey);
  if (!result.valid) {
    return { success: false, error: result.error };
  }

  const license = loadLicenseSync();
  license.tier = 'max';
  license.status = 'active';
  license.holder = result.holder;
  license.licenseKey = rawKey.trim();
  license.keyExpiresAt = result.expiresAt;
  license.activatedAt = Date.now();

  await saveLicense(license);

  return {
    success: true,
    message: result.isLifetime 
      ? `🎉 AutoClip Max Activated! Lifetime VIP access unlocked for ${result.holder}.`
      : `🎉 AutoClip Max Activated! 1-Year Access unlocked for ${result.holder}.`,
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

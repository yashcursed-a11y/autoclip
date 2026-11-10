const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { DATA } = require('./config');

const LICENSE_FILE = path.join(DATA, 'license.json');
const SECRET_SALT = process.env.AUTOCLIP_LICENSE_SALT || 'AUTOCLIP_OFFLINE_SECRET_SALT_2026_MAX_VIP';

const WEEKLY_LIMIT = 70;
const TRIAL_DAYS = 30;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

// Pricing & Quota Definitions
const TIERS = {
  free_trial: { id: 'free_trial', name: 'Starter Free Pass', price: 0, clipLimit: 70, interval: 'week', unlimited: false },
  max: { id: 'max', name: 'AUTOCLIPIN Max', price: 20, clipLimit: 1500, interval: 'month', unlimited: false },
  ultra: { id: 'ultra', name: 'AUTOCLIPIN Ultra', price: 50, clipLimit: 999999, interval: 'month', unlimited: true },
  yearly: { id: 'yearly', name: 'AUTOCLIPIN Yearly VIP', price: 200, clipLimit: 999999, interval: 'year', unlimited: true }
};

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

  // First launch default license: 30-Day Free Pass with 70 reels/week
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
 * Check and advance the rolling quota windows
 */
function refreshWeeklyQuota(license) {
  if (!license) return;

  const now = Date.now();
  if (license.weeklyLimit !== WEEKLY_LIMIT) {
    license.weeklyLimit = WEEKLY_LIMIT;
    saveLicenseSync(license);
  }

  if (license.weeklyPeriodStart) {
    const elapsed = now - license.weeklyPeriodStart;
    if (elapsed >= SEVEN_DAYS_MS) {
      const weeksPassed = Math.floor(elapsed / SEVEN_DAYS_MS);
      license.weeklyPeriodStart += weeksPassed * SEVEN_DAYS_MS;
      license.clipsExportedThisWeek = 0;
      saveLicenseSync(license);
    }
  }

  // Monthly quota refresh for Max plan (1,500 reels / month, 50 reels / day)
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
 * Get sanitized client-friendly license status
 */
function getLicenseStatus() {
  const license = loadLicenseSync();
  const now = Date.now();

  const isPro = ['max', 'ultra', 'yearly'].includes(license.tier) && license.status === 'active';
  const isMax = (license.tier === 'max' || license.tier === 'ultra' || license.tier === 'yearly') && license.status === 'active';
  const isUnlimited = (license.tier === 'ultra' || license.tier === 'yearly') && license.status === 'active';
  const isExpired = license.status === 'expired';

  const trialDaysRemaining = license.trialExpiresAt 
    ? Math.max(0, Math.ceil((license.trialExpiresAt - now) / (24 * 60 * 60 * 1000)))
    : 0;

  const msUntilWeeklyReset = Math.max(0, (license.weeklyPeriodStart + SEVEN_DAYS_MS) - now);
  const daysUntilWeeklyReset = Math.ceil(msUntilWeeklyReset / (24 * 60 * 60 * 1000));

  let clipsRemaining = 0;
  if (isUnlimited) {
    clipsRemaining = 999999;
  } else if (license.tier === 'max') {
    clipsRemaining = Math.max(0, 1500 - (license.clipsExportedThisMonth || 0));
  } else {
    clipsRemaining = Math.max(0, (license.weeklyLimit || WEEKLY_LIMIT) - (license.clipsExportedThisWeek || 0));
  }

  return {
    tier: license.tier || 'free_trial',
    tierName: TIERS[license.tier]?.name || 'Starter Free Pass',
    isPro,
    isMax,
    isUnlimited,
    isExpired,
    status: license.status,
    holder: license.holder || 'Creator',
    weeklyLimit: license.weeklyLimit || WEEKLY_LIMIT,
    monthlyLimit: license.tier === 'max' ? 1500 : (isUnlimited ? 999999 : null),
    dailyLimit: license.tier === 'max' ? 50 : null,
    clipsExportedThisWeek: license.clipsExportedThisWeek || 0,
    clipsExportedThisMonth: license.clipsExportedThisMonth || 0,
    clipsRemaining,
    clipsRemainingThisWeek: isMax ? clipsRemaining : Math.max(0, (license.weeklyLimit || WEEKLY_LIMIT) - (license.clipsExportedThisWeek || 0)),
    totalClipsExported: license.totalClipsExported || 0,
    trialDaysRemaining,
    trialExpiresAt: license.trialExpiresAt,
    daysUntilWeeklyReset,
    msUntilWeeklyReset,
    licenseKey: license.licenseKey ? `${license.licenseKey.slice(0, 12)}...` : null,
    keyExpiresAt: license.keyExpiresAt,
    isLifetime: isUnlimited && !license.keyExpiresAt,
    tiers: TIERS
  };
}

/**
 * Check if the user is authorized to export N clips right now
 */
function canExportClips(count = 1) {
  const license = loadLicenseSync();
  const now = Date.now();

  // 1. Check expiration for paid tiers
  if (['max', 'ultra', 'yearly'].includes(license.tier)) {
    if (license.keyExpiresAt && now > license.keyExpiresAt) {
      return {
        allowed: false,
        reason: 'key_expired',
        message: `Your ${TIERS[license.tier]?.name || 'AUTOCLIPIN'} subscription has expired. Please renew or enter an active license key to continue exporting.`
      };
    }

    // Unlimited tiers: Ultra & Yearly
    if (license.tier === 'ultra' || license.tier === 'yearly') {
      return {
        allowed: true,
        tier: license.tier,
        unlimited: true
      };
    }

    // Max tier: 1500 reels / month (50 reels / day)
    if (license.tier === 'max') {
      const monthUsed = license.clipsExportedThisMonth || 0;
      if (monthUsed + count > 1500) {
        return {
          allowed: false,
          reason: 'monthly_quota_exceeded',
          message: `Monthly Max limit reached (1,500 reels / 50 per day). You have exported ${monthUsed}/1,500 reels this month. Upgrade to Ultra ($50/mo) for unlimited exports!`,
          currentMonthUsed: monthUsed,
          limit: 1500
        };
      }
      return {
        allowed: true,
        tier: 'max',
        remainingThisMonth: 1500 - (monthUsed + count)
      };
    }
  }

  // 2. Check 30-Day Free Pass Expiration
  if (now > license.trialExpiresAt) {
    return {
      allowed: false,
      reason: 'trial_expired',
      message: 'Your 30-day Free Pass has ended! Upgrade to Max ($20/mo for 50 reels/day) or Ultra ($50/mo) to continue exporting clips.'
    };
  }

  // 3. Check Free Tier Limit (70 reels / week)
  const currentWeekUsed = license.clipsExportedThisWeek || 0;
  const limit = license.weeklyLimit || WEEKLY_LIMIT;

  if (currentWeekUsed + count > limit) {
    const msUntilReset = Math.max(0, (license.weeklyPeriodStart + SEVEN_DAYS_MS) - now);
    const daysUntilReset = Math.ceil(msUntilReset / (24 * 60 * 60 * 1000));
    return {
      allowed: false,
      reason: 'weekly_quota_exceeded',
      message: `Weekly limit reached! You have exported ${currentWeekUsed}/${limit} reels this week. Your quota resets in ${daysUntilReset} day(s). Upgrade to Max ($20/mo for 50 reels/day · 1,500/mo) or Ultra for unlimited!`,
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
    message: `${result.tierName} Activated! ${durationStr} unlocked for ${result.holder}.`,
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

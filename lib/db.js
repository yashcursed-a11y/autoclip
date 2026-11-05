const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const {
  DATA,
  INCOMING,
  FINISHED,
  TRANSCRIPTS,
  WATERMARKS_DIR,
  JOBS_FILE,
  SETTINGS_FILE,
  PRESETS_FILE,
  FEEDBACK_FILE,
  ACCOUNTS_FILE,
  POSTS_FILE,
  POST_LOGS_FILE,
  DEFAULT_ACCOUNTS,
  TOKEN_FILE,
  TOKENS_DIR
} = require('./config');

// Ensure all working directories exist
for (const dir of [DATA, INCOMING, FINISHED, TRANSCRIPTS, WATERMARKS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// In-memory mutex for file writes to prevent Windows EPERM / race conditions
let writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  writeQueue = writeQueue.then(fn, fn);
  return writeQueue;
}

async function safeAtomicWrite(filePath, content) {
  const tmp = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    await fsp.writeFile(tmp, content, 'utf8');

    // Windows atomic rename with retry & copyFile fallback
    let renamed = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await fsp.rename(tmp, filePath);
        renamed = true;
        break;
      } catch (err) {
        if (['EPERM', 'EBUSY', 'EACCES'].includes(err.code) && attempt < 9) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 50));
        } else {
          break;
        }
      }
    }

    if (!renamed) {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          await fsp.copyFile(tmp, filePath);
          renamed = true;
          break;
        } catch (err) {
          if (attempt < 5) {
            await new Promise(r => setTimeout(r, (attempt + 1) * 50));
          }
        }
      }
    }

    if (!renamed) {
      // Final fallback: direct file overwrite with retries
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await fsp.writeFile(filePath, content, 'utf8');
          renamed = true;
          break;
        } catch (err) {
          if (attempt < 4) {
            await new Promise(r => setTimeout(r, (attempt + 1) * 50));
          } else {
            throw err;
          }
        }
      }
    }
  } finally {
    try {
      if (fs.existsSync(tmp)) {
        await fsp.unlink(tmp);
      }
    } catch {}
  }
}

async function readJson(file, defaultValue = []) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

async function writeJson(file, data) {
  const content = JSON.stringify(data, null, 2);
  return enqueueWrite(() => safeAtomicWrite(file, content));
}

// In-memory cache for jobs with mtime invalidation to guarantee zero lag and sync across processes
let cachedJobs = null;
let cachedJobsMtime = 0;
let pendingProgressFlush = null;

async function loadJobsCache() {
  try {
    const st = fs.statSync(JOBS_FILE);
    if (cachedJobs === null || st.mtimeMs > cachedJobsMtime) {
      cachedJobs = await readJson(JOBS_FILE, []);
      cachedJobsMtime = st.mtimeMs;
    }
  } catch {
    if (cachedJobs === null) cachedJobs = [];
  }
  return cachedJobs;
}

// Jobs
async function getJobs() {
  await loadJobsCache();
  return cachedJobs.slice();
}

async function getJob(id) {
  await loadJobsCache();
  return cachedJobs.find(j => j.id === id) || null;
}

async function saveJob(job) {
  await loadJobsCache();
  const index = cachedJobs.findIndex(j => j.id === job.id);
  if (index >= 0) {
    cachedJobs[index] = { ...cachedJobs[index], ...job, updatedAt: new Date().toISOString() };
  } else {
    cachedJobs.unshift({ ...job, createdAt: job.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  await writeJson(JOBS_FILE, cachedJobs);
  return cachedJobs.find(j => j.id === job.id);
}

async function updateJob(id, patch) {
  await loadJobsCache();
  const index = cachedJobs.findIndex(j => j.id === id);
  if (index < 0) throw new Error(`Job not found: ${id}`);
  
  cachedJobs[index] = { ...cachedJobs[index], ...patch, updatedAt: new Date().toISOString() };
  
  // If the patch is ONLY a progress update, throttle disk write by 300ms
  const isProgressOnly = Object.keys(patch).length === 1 && patch.progress;
  if (isProgressOnly) {
    if (!pendingProgressFlush) {
      pendingProgressFlush = setTimeout(async () => {
        pendingProgressFlush = null;
        await writeJson(JOBS_FILE, cachedJobs);
      }, 300);
    }
  } else {
    if (pendingProgressFlush) {
      clearTimeout(pendingProgressFlush);
      pendingProgressFlush = null;
    }
    await writeJson(JOBS_FILE, cachedJobs);
  }

  return cachedJobs[index];
}

async function deleteJob(id) {
  await loadJobsCache();
  cachedJobs = cachedJobs.filter(j => j.id !== id);
  await writeJson(JOBS_FILE, cachedJobs);
  return true;
}

// Settings
async function getSettings() {
  const defaultSettings = {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    activeAiProvider: 'offline', // 'offline' | 'gemini' | 'claude' | 'openai'
    whisperModel: 'tiny', // 'tiny' | 'base' | 'small'
    defaultLanguage: 'auto',
    defaultAspect: '9:16',
    defaultCaptionPreset: 'viral-pop',
    defaultFramingPreset: 'smart-crop',
    autoTrashOriginal: false,
    driveFolderId: ''
  };
  const saved = await readJson(SETTINGS_FILE, {});
  return { ...defaultSettings, ...saved };
}

async function saveSettings(patch) {
  const current = await getSettings();
  const updated = { ...current, ...patch };
  await writeJson(SETTINGS_FILE, updated);
  return updated;
}

// Presets & Tag Memory Bank (Title Hooks, Description Signatures, Hashtags)
const DEFAULT_PRESETS = {
  tags: [
    '#DoubleCoverage',
    '#fyp',
    '#viral',
    '#shorts',
    '#reels',
    '#trending',
    '#podcast',
    '#highlights',
    '#foryou'
  ],
  titleHooks: [
    { id: 'hook_1', label: 'Wait until the end... 🤯', text: 'Wait until the end... 🤯 ' },
    { id: 'hook_2', label: 'Double Coverage |', text: 'Double Coverage | ' },
    { id: 'hook_3', label: "You won't believe this 😱", text: "You won't believe what happened... " },
    { id: 'hook_4', label: 'PART 1 🎬', text: 'PART 1: ' },
    { id: 'hook_5', label: 'INSANE Moment 🔥', text: 'THIS MOMENT WAS INSANE 🔥 ' }
  ],
  descriptionTemplates: [
    {
      id: 'desc_1',
      name: '📌 Channel Links & Bio',
      text: "Subscribe for daily highlights and moments! 🔔\nDrop a comment with your thoughts below 👇\n\nFollow us across platforms for more exclusive clips."
    },
    {
      id: 'desc_2',
      name: '🔥 Viral Clip CTA',
      text: "Wait till you hear the full story... 🤯\n\nLike and follow for part 2! Which moment hit hardest? 👇"
    },
    {
      id: 'desc_3',
      name: '🏈 Double Coverage Signature',
      text: "Double Coverage Moments — daily sports banter & top viral plays!\n\n🔔 Subscribe to never miss a drop.\n#DoubleCoverage #NFL #Shorts"
    }
  ]
};

let cachedPresets = null;

async function loadPresetsCache() {
  if (cachedPresets === null) {
    if (!fs.existsSync(PRESETS_FILE)) {
      cachedPresets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
      await writeJson(PRESETS_FILE, cachedPresets);
    } else {
      const data = await readJson(PRESETS_FILE, DEFAULT_PRESETS);
      cachedPresets = {
        tags: Array.isArray(data.tags) && data.tags.length ? data.tags : DEFAULT_PRESETS.tags.slice(),
        titleHooks: Array.isArray(data.titleHooks) && data.titleHooks.length ? data.titleHooks : DEFAULT_PRESETS.titleHooks.slice(),
        descriptionTemplates: Array.isArray(data.descriptionTemplates) && data.descriptionTemplates.length ? data.descriptionTemplates : DEFAULT_PRESETS.descriptionTemplates.slice()
      };
    }
  }
  return cachedPresets;
}

async function getPresets() {
  await loadPresetsCache();
  return cachedPresets;
}

async function savePresets(patch) {
  await loadPresetsCache();
  cachedPresets = {
    ...cachedPresets,
    ...patch
  };
  await writeJson(PRESETS_FILE, cachedPresets);
  return cachedPresets;
}

async function rememberTags(newTags) {
  await loadPresetsCache();
  if (!newTags) return cachedPresets.tags;
  const list = Array.isArray(newTags) ? newTags : String(newTags).split(/[\s,]+/);
  const existingSet = new Set(cachedPresets.tags.map(t => t.toLowerCase()));
  let modified = false;

  for (let raw of list) {
    let t = String(raw).trim();
    if (!t) continue;
    if (!t.startsWith('#')) t = '#' + t;
    t = t.replace(/[^\w#\u0590-\u05ff]/g, '');
    if (t.length <= 1) continue;

    if (!existingSet.has(t.toLowerCase())) {
      existingSet.add(t.toLowerCase());
      cachedPresets.tags.unshift(t);
      modified = true;
    }
  }

  if (modified) {
    await writeJson(PRESETS_FILE, cachedPresets);
  }
  return cachedPresets.tags;
}

async function removeTag(tagToRemove) {
  await loadPresetsCache();
  const target = String(tagToRemove).trim().toLowerCase();
  cachedPresets.tags = cachedPresets.tags.filter(t => t.toLowerCase() !== target && t.replace(/^#/, '').toLowerCase() !== target.replace(/^#/, ''));
  await writeJson(PRESETS_FILE, cachedPresets);
  return cachedPresets.tags;
}

async function saveTitleHook({ label, text }) {
  await loadPresetsCache();
  const id = `hook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanLabel = (label || text).slice(0, 40);
  const newHook = { id, label: cleanLabel, text: text || cleanLabel };
  cachedPresets.titleHooks.unshift(newHook);
  await writeJson(PRESETS_FILE, cachedPresets);
  return newHook;
}

async function removeTitleHook(id) {
  await loadPresetsCache();
  cachedPresets.titleHooks = cachedPresets.titleHooks.filter(h => h.id !== id);
  await writeJson(PRESETS_FILE, cachedPresets);
  return cachedPresets.titleHooks;
}

async function saveDescriptionTemplate({ name, text }) {
  await loadPresetsCache();
  const id = `desc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanName = (name || 'Custom Template').slice(0, 40);
  const newTemplate = { id, name: cleanName, text };
  cachedPresets.descriptionTemplates.unshift(newTemplate);
  await writeJson(PRESETS_FILE, cachedPresets);
  return newTemplate;
}

async function removeDescriptionTemplate(id) {
  await loadPresetsCache();
  cachedPresets.descriptionTemplates = cachedPresets.descriptionTemplates.filter(d => d.id !== id);
  await writeJson(PRESETS_FILE, cachedPresets);
  return cachedPresets.descriptionTemplates;
}

async function resetPresets() {
  cachedPresets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
  await writeJson(PRESETS_FILE, cachedPresets);
  return cachedPresets;
}

// Feedback (learning from user accept/reject/tweaks)
async function getFeedback() {
  return await readJson(FEEDBACK_FILE, { accepted: [], rejected: [], adjustments: [] });
}

async function recordFeedback(entry) {
  const fb = await getFeedback();
  if (entry.action === 'accept') {
    fb.accepted.push({ ...entry, timestamp: new Date().toISOString() });
    if (fb.accepted.length > 200) fb.accepted.shift();
  } else if (entry.action === 'reject') {
    fb.rejected.push({ ...entry, timestamp: new Date().toISOString() });
    if (fb.rejected.length > 200) fb.rejected.shift();
  } else if (entry.action === 'adjust') {
    fb.adjustments.push({ ...entry, timestamp: new Date().toISOString() });
    if (fb.adjustments.length > 200) fb.adjustments.shift();
  }
  await writeJson(FEEDBACK_FILE, fb);
  return fb;
}

// Social Accounts (10+ accounts)
let cachedAccounts = null;

async function loadAccountsCache() {
  if (cachedAccounts === null) {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      cachedAccounts = DEFAULT_ACCOUNTS.slice();
      await writeJson(ACCOUNTS_FILE, cachedAccounts);
    } else {
      cachedAccounts = await readJson(ACCOUNTS_FILE, DEFAULT_ACCOUNTS.slice());
    }
  }
  return cachedAccounts;
}

async function getAccounts() {
  await loadAccountsCache();
  return cachedAccounts.map(acc => {
    let isLinked = false;
    if (acc.platform === 'shorts') {
      const specific = path.join(TOKENS_DIR, `${acc.id}.json`);
      isLinked = fs.existsSync(specific) || fs.existsSync(TOKEN_FILE);
    } else if (acc.apiToken && acc.apiToken.trim()) {
      isLinked = true;
    }
    return { ...acc, isLinked };
  });
}

async function saveAccount(account) {
  await loadAccountsCache();
  const newAcc = {
    id: account.id || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: account.name || 'Social Account',
    handle: account.handle || '@channel',
    platform: account.platform || 'tiktok',
    enabled: account.enabled !== false,
    category: account.category || 'General',
    avatarColor: account.avatarColor || '#fe2c55',
    apiToken: account.apiToken || '',
    privacy: account.privacy || 'public',
    directPosting: true,
    createdAt: new Date().toISOString()
  };
  cachedAccounts.push(newAcc);
  await writeJson(ACCOUNTS_FILE, cachedAccounts);
  return newAcc;
}

async function updateAccount(id, patch) {
  await loadAccountsCache();
  const idx = cachedAccounts.findIndex(a => a.id === id);
  if (idx === -1) throw new Error(`Account ${id} not found.`);
  cachedAccounts[idx] = { ...cachedAccounts[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeJson(ACCOUNTS_FILE, cachedAccounts);
  return cachedAccounts[idx];
}

async function deleteAccount(id) {
  await loadAccountsCache();
  cachedAccounts = cachedAccounts.filter(a => a.id !== id);
  await writeJson(ACCOUNTS_FILE, cachedAccounts);
  return true;
}

async function resetAccounts() {
  cachedAccounts = DEFAULT_ACCOUNTS.slice();
  await writeJson(ACCOUNTS_FILE, cachedAccounts);
  return cachedAccounts;
}

// Scheduled Posts Management
let cachedPosts = null;

async function loadPostsCache() {
  if (cachedPosts === null) {
    cachedPosts = await readJson(POSTS_FILE, []);
  }
  return cachedPosts;
}

async function getPosts() {
  await loadPostsCache();
  return cachedPosts.slice();
}

async function getPost(id) {
  await loadPostsCache();
  return cachedPosts.find(p => p.id === id) || null;
}

async function savePost(postData) {
  await loadPostsCache();
  const post = {
    id: postData.id || `post_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: postData.title || '',
    caption: postData.caption || '',
    hashtags: Array.isArray(postData.hashtags) ? postData.hashtags : (postData.hashtags ? String(postData.hashtags).split(/\s+/).filter(Boolean) : []),
    firstComment: postData.firstComment || '',
    clipId: postData.clipId || null,
    jobId: postData.jobId || null,
    clipName: postData.clipName || 'Short-Form Clip',
    videoPath: postData.videoPath || '',
    videoUrl: postData.videoUrl || '',
    accountIds: Array.isArray(postData.accountIds) ? postData.accountIds : [],
    status: postData.status || 'scheduled', // 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
    immediate: Boolean(postData.immediate),
    isRendered: Boolean(postData.isRendered !== false),
    scheduledAt: postData.scheduledAt || new Date().toISOString(),
    publishedAt: postData.publishedAt || null,
    deliveryResults: postData.deliveryResults || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  cachedPosts.unshift(post);
  await writeJson(POSTS_FILE, cachedPosts);
  return post;
}

async function updatePost(id, patch) {
  await loadPostsCache();
  const idx = cachedPosts.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Post ${id} not found.`);
  cachedPosts[idx] = { ...cachedPosts[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeJson(POSTS_FILE, cachedPosts);
  return cachedPosts[idx];
}

async function deletePost(id) {
  await loadPostsCache();
  cachedPosts = cachedPosts.filter(p => p.id !== id);
  await writeJson(POSTS_FILE, cachedPosts);
  return true;
}

// Post execution log
async function appendPostLog(entry) {
  const logs = await readJson(POST_LOGS_FILE, []);
  logs.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (logs.length > 500) logs.pop();
  await writeJson(POST_LOGS_FILE, logs);
  return logs[0];
}

async function getPostLogs() {
  return await readJson(POST_LOGS_FILE, []);
}

module.exports = {
  getJobs,
  getJob,
  saveJob,
  updateJob,
  deleteJob,
  getSettings,
  saveSettings,
  getFeedback,
  recordFeedback,
  getAccounts,
  saveAccount,
  updateAccount,
  deleteAccount,
  resetAccounts,
  getPosts,
  getPost,
  savePost,
  updatePost,
  deletePost,
  appendPostLog,
  getPostLogs,
  getPresets,
  savePresets,
  rememberTags,
  removeTag,
  saveTitleHook,
  removeTitleHook,
  saveDescriptionTemplate,
  removeDescriptionTemplate,
  resetPresets
};

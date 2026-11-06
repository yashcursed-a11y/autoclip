const express = require('express');
const multer = require('multer');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const {
  ROOT,
  DATA,
  INCOMING,
  FINISHED,
  WATERMARKS_DIR,
  TEMPLATES,
  CAPTION_PRESETS,
  FRAMING_PRESETS,
  ASPECT_RATIOS,
  OAUTH_FILE,
  TOKEN_FILE,
  TOKENS_DIR
} = require('./lib/config');

const {
  getJobs,
  getJob,
  saveJob,
  updateJob,
  deleteJob,
  getSettings,
  saveSettings,
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
} = require('./lib/db');

const { initScheduler, publishPost, generatePostMetadata } = require('./lib/poster');

const { getSystemStatus } = require('./lib/system');
const { downloadUrl, safeName } = require('./lib/downloader');
const { getVideoInfo, renderClip } = require('./lib/renderer');
const { processVideo, renderJob, cancelJob } = require('./lib/job-runner');
const { splitStreamIntoParts } = require('./lib/analyzer');
const { getAdaptiveFramingPlan } = require('./lib/auto-framing');
const { buildSmartCallouts } = require('./lib/smart-text');
const { runAutoPilot, getAutoPilotStatus } = require('./lib/autopilot');
const { getShortsAnalytics } = require('./lib/analytics');
const { getAllOverlays, saveCustomOverlay } = require('./lib/memes');
const {
  getOAuthClient,
  getAuthUrl,
  getYouTubeAuthUrl,
  handleCallback
} = require('./lib/drive');

const {
  getLicenseStatus,
  canExportClips,
  activateLicenseKey
} = require('./lib/licensing');

const {
  initLogger,
  recentLogs,
  getActiveProcesses,
  killProcess,
  emergencyStop,
  recordIncident,
  loadIncidents,
  clearIncidents,
  cleanupTempFiles,
  getHardwareTelemetry
} = require('./lib/diagnostics');

initLogger();

const app = express();
const PORT = Number(process.env.PORT || 4173);

app.use((req, res, next) => {
  if (req.url.startsWith('/api') || req.url === '/') {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/media', express.static(FINISHED));
app.use('/finished', express.static(FINISHED));
app.use('/incoming', express.static(INCOMING));
app.use('/watermarks', express.static(WATERMARKS_DIR));
const OVERLAYS_DIR = path.join(DATA, 'overlays');
app.use('/overlays', express.static(OVERLAYS_DIR));
app.use('/assets', express.static(path.join(ROOT, 'public', 'assets')));

// Multer storage for uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, INCOMING),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 * 1024 } // 100 GB limit for streams
});

// Multer storage for Watermarks / Channel Logos
const wmStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, WATERMARKS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `wm_${crypto.randomUUID()}${ext}`);
  }
});
const wmUpload = multer({
  storage: wmStorage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB max watermark image
});

app.post('/api/watermark/upload', wmUpload.single('watermark'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose an image file for the watermark.' });
  res.json({
    filePath: req.file.path,
    url: `/watermarks/${path.basename(req.file.path)}`,
    filename: req.file.originalname
  });
});

// Multer storage for Custom B-Roll & Meme Overlays
const overlayStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, OVERLAYS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `ov_${crypto.randomUUID()}${ext}`);
  }
});
const overlayUpload = multer({
  storage: overlayStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max for video/image overlay
});

// GET Meme & Reaction Catalog
app.get('/api/memes', async (_req, res) => {
  try {
    const catalog = await getAllOverlays();
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Viral Background Music Catalog (Deagzzz & Daniel Bitton Short-Form Beds)
app.get('/api/music', (_req, res) => {
  try {
    const { MUSIC_CATALOG } = require('./lib/memes');
    const tracks = (MUSIC_CATALOG || []).map(m => ({
      ...m,
      url: `/assets/music/${m.filename}`
    }));
    res.json(tracks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST In-App AI Assistant / Copilot Chat
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { answerAssistantQuery } = require('./lib/assistant-knowledge');
    const { message, history } = req.body || {};
    const reply = await answerAssistantQuery(message, history || []);
    const suggestions = Array.isArray(reply.suggestedTopics) ? reply.suggestedTopics.map(s => s.title || s) : (reply.suggestions || []);
    res.json({
      ...reply,
      answer: reply.text || reply.answer || '',
      suggestions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Custom Overlay Upload (MP4, GIF, PNG)
app.post('/api/overlays/upload', overlayUpload.single('overlayFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please choose a file to upload.' });
    const isVideo = /\.(mp4|mov|webm)$/i.test(req.file.originalname);
    const item = {
      id: `custom_${crypto.randomUUID()}`,
      name: path.basename(req.file.originalname, path.extname(req.file.originalname)),
      icon: isVideo ? '🎬' : '🖼️',
      tagline: isVideo ? 'Custom B-Roll Video' : 'Custom Image / Sticker',
      filePath: req.file.path,
      url: `/overlays/${path.basename(req.file.path)}`,
      isVideo,
      defaultDuration: 2.5,
      defaultPosition: 'center',
      defaultScale: 0.55,
      isCustom: true,
      createdAt: new Date().toISOString()
    };
    await saveCustomOverlay(item);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove Background from Watermark Image
app.post('/api/watermark/remove-bg', async (req, res) => {
  try {
    const { imagePath, mode = 'auto', tolerance = 35, keyColor = '#ffffff', feather = 1 } = req.body;
    let resolvedPath = imagePath;
    if (!resolvedPath) {
      return res.status(400).json({ error: 'No image path provided.' });
    }
    if (resolvedPath.startsWith('/watermarks/')) {
      resolvedPath = path.join(WATERMARKS_DIR, path.basename(resolvedPath));
    }
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Watermark source file not found.' });
    }

    const ext = path.extname(resolvedPath);
    const baseName = path.basename(resolvedPath, ext);
    const outFilename = `clean_${baseName}_${Date.now()}.png`;
    const outPath = path.join(WATERMARKS_DIR, outFilename);
    const scriptPath = path.join(ROOT, 'scripts', 'remove_bg.py');

    const args = [
      scriptPath,
      resolvedPath,
      outPath,
      mode,
      String(tolerance),
      keyColor,
      String(feather)
    ];

    const proc = spawn('python', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outPath)) {
        res.json({
          success: true,
          filePath: outPath,
          url: `/watermarks/${outFilename}`,
          filename: outFilename
        });
      } else {
        res.status(500).json({ error: `Background removal failed: ${stderr || stdout || 'Unknown error'}` });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. System & Bootstrap Endpoints
app.get('/api/system/status', async (_req, res) => {
  try {
    const status = await getSystemStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real-Time System Telemetry & Hardware Process Diagnostics
app.get('/api/system/diagnostics/telemetry', async (_req, res) => {
  try {
    const telemetry = getHardwareTelemetry();
    const processes = getActiveProcesses();
    const incidents = await loadIncidents();
    res.json({
      ...telemetry,
      processes,
      recentIncidentsCount: incidents.length,
      unresolvedCriticalCount: incidents.filter(i => i.severity === 'CRITICAL').length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/diagnostics/processes', (_req, res) => {
  try {
    res.json(getActiveProcesses());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/diagnostics/processes/:pid/kill', (req, res) => {
  try {
    const result = killProcess(req.params.pid);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/diagnostics/emergency-stop', (_req, res) => {
  try {
    const result = emergencyStop();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/diagnostics/cleanup', async (_req, res) => {
  try {
    const result = await cleanupTempFiles();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/diagnostics/incidents', async (_req, res) => {
  try {
    const incidents = await loadIncidents();
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/diagnostics/incidents/clear', async (_req, res) => {
  try {
    const result = await clearIncidents();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/diagnostics/logs', (req, res) => {
  try {
    const limit = Math.min(250, Math.max(10, Number(req.query.limit) || 100));
    const level = req.query.level;
    let logs = recentLogs;
    if (level) {
      logs = logs.filter(l => l.level === level.toUpperCase());
    }
    res.json(logs.slice(-limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const jobs = await getJobs();
    const settings = await getSettings();
    const status = await getSystemStatus();

    res.json({
      templates: TEMPLATES,
      captionPresets: CAPTION_PRESETS,
      framingPresets: FRAMING_PRESETS,
      aspectRatios: ASPECT_RATIOS,
      jobs,
      settings,
      presets: await getPresets(),
      system: status,
      license: getLicenseStatus(),
      driveConnected: status.drive.connected,
      oauthConfigured: status.drive.oauthConfigured
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Licensing & Pro Activation APIs
app.get('/api/license', (_req, res) => {
  try {
    delete require.cache[require.resolve('./lib/licensing')];
    const { getLicenseStatus: freshGetLicenseStatus } = require('./lib/licensing');
    res.json(freshGetLicenseStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/license/activate', async (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: 'License key is required.' });
    delete require.cache[require.resolve('./lib/licensing')];
    const { activateLicenseKey: freshActivateLicenseKey } = require('./lib/licensing');
    const result = await freshActivateLicenseKey(key);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings API
app.get('/api/settings', async (_req, res) => {
  try {
    res.json(await getSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const updated = await saveSettings(req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Available Auto Clip Rating Systems
app.get('/api/rating-systems', (_req, res) => {
  res.json([
    {
      id: 'beast',
      name: '🦁 CRAZY BEAST Engine v2.0 (Brock Johnson, Deagzzz & Ollex)',
      description: '1,300 Hook Study Data (Negative Framing 2.3x CTR, 5-8 Word Sweet Spot), +6.5dB Audio Redline, 180° Twists & Lemon Milk Bold.',
      badge: '👑 ULTIMATE BEAST v2.0',
      type: 'hybrid'
    },
    {
      id: 'hollywood',
      name: '🎬 HOLLYWOOD Rating System',
      description: 'Zero delay, 6th-grade clarity, viewer pain relevance & high-contrast curiosity loops.',
      badge: 'Recommended',
      type: 'hybrid'
    },
    {
      id: 'offline_v3',
      name: '⚡ Offline v3 Engine',
      description: 'High-energy audio/ASR density, pace transitions, exclamation markers & 100% offline analysis.',
      badge: 'Fast Offline',
      type: 'offline'
    },
    {
      id: 'claude',
      name: '🧠 Anthropic Claude 3.5 Sonnet',
      description: 'Deep semantic storytelling and retention optimization via Claude API.',
      badge: 'Cloud AI',
      type: 'ai'
    },
    {
      id: 'openai',
      name: '🟢 OpenAI GPT-4o Viral Engine',
      description: 'GPT-4o viral hook detection and retention modeling.',
      badge: 'Cloud AI',
      type: 'ai'
    },
    {
      id: 'gemini',
      name: '✨ Google Gemini 1.5 Flash',
      description: 'Fast multimodal transcript parsing and topic segmentation.',
      badge: 'Cloud AI',
      type: 'ai'
    }
  ]);
});

// Test AI Provider API Key
app.post('/api/ai/test', async (req, res) => {
  try {
    const { provider, apiKey } = req.body || {};
    const { callClaude, callOpenAI, callGemini } = require('./lib/ai-providers');
    let reply = '';
    if (provider === 'claude') {
      reply = await callClaude(apiKey, 'You are an AI assistant.', 'Reply with "Claude connected successfully!"');
    } else if (provider === 'openai') {
      reply = await callOpenAI(apiKey, 'You are an AI assistant.', 'Reply with "OpenAI connected successfully!"');
    } else if (provider === 'gemini') {
      reply = await callGemini(apiKey, 'You are an AI assistant.', 'Reply with "Gemini connected successfully!"');
    } else {
      return res.json({ success: true, message: 'Offline v3 Engine is active.' });
    }
    res.json({ success: true, reply });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Model Context Protocol (MCP) HTTP Endpoint for Claude & ChatGPT
app.post('/api/mcp', async (req, res) => {
  try {
    const { method, params, id } = req.body || {};
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'autoclip-mcp', version: '1.0.1' }
        }
      });
    }

    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'list_projects',
              description: 'List all video projects currently imported or processed in AUTOCLIPIN Studio.',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'get_video_transcript',
              description: 'Retrieve the full word-by-word spoken transcript with timestamps and audio contrast.',
              inputSchema: {
                type: 'object',
                properties: { jobId: { type: 'string' } },
                required: ['jobId']
              }
            },
            {
              name: 'create_clip_candidate',
              description: 'Add a new discovered highlight clip or cut to the AutoClip CapCut timeline.',
              inputSchema: {
                type: 'object',
                properties: {
                  jobId: { type: 'string' },
                  start: { type: 'number' },
                  end: { type: 'number' },
                  title: { type: 'string' },
                  hook: { type: 'string' },
                  score: { type: 'number' }
                },
                required: ['jobId', 'start', 'end', 'title']
              }
            }
          ]
        }
      });
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      if (toolName === 'list_projects') {
        const jobs = await getJobs();
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify(jobs.map(j => ({
                id: j.id,
                name: j.sourceName || j.sourceUrl,
                duration: j.duration,
                clipsCount: (j.clips || []).length
              })), null, 2)
            }]
          }
        });
      }
      if (toolName === 'get_video_transcript') {
        const job = await getJob(toolArgs.jobId);
        if (!job) return res.json({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: 'Job not found' }] } });
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: typeof job.transcript === 'string' ? job.transcript : JSON.stringify(job.transcript) }]
          }
        });
      }
      if (toolName === 'create_clip_candidate') {
        const job = await getJob(toolArgs.jobId);
        if (!job) return res.json({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: 'Job not found' }] } });
        const newClip = {
          id: crypto.randomUUID ? crypto.randomUUID() : `clip_${Date.now()}`,
          start: Number(toolArgs.start),
          end: Number(toolArgs.end),
          title: toolArgs.title,
          hook: toolArgs.hook || toolArgs.title,
          score: Number(toolArgs.score) || 90,
          source: 'mcp'
        };
        job.clips = job.clips || [];
        job.clips.push(newClip);
        await updateJob(job.id, { clips: job.clips });
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `✓ Clip "${newClip.title}" created at ${newClip.start}s - ${newClip.end}s` }]
          }
        });
      }
    }

    res.status(404).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  } catch (err) {
    res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message } });
  }
});

// Presets & Tag Memory Bank API
app.get('/api/presets', async (_req, res) => {
  try {
    res.json(await getPresets());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/presets', async (req, res) => {
  try {
    const updated = await savePresets(req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/presets/tags', async (req, res) => {
  try {
    const { tag, tags } = req.body;
    const toRemember = tags || [tag];
    const updatedTags = await rememberTags(toRemember);
    res.json({ tags: updatedTags });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/presets/tags/:tag', async (req, res) => {
  try {
    const updatedTags = await removeTag(req.params.tag);
    res.json({ tags: updatedTags });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/presets/title-hook', async (req, res) => {
  try {
    const newHook = await saveTitleHook(req.body);
    res.json(newHook);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/presets/title-hook/:id', async (req, res) => {
  try {
    const hooks = await removeTitleHook(req.params.id);
    res.json({ titleHooks: hooks });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/presets/description-template', async (req, res) => {
  try {
    const newTemplate = await saveDescriptionTemplate(req.body);
    res.json(newTemplate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/presets/description-template/:id', async (req, res) => {
  try {
    const templates = await removeDescriptionTemplate(req.params.id);
    res.json({ descriptionTemplates: templates });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/presets/reset', async (_req, res) => {
  try {
    const reset = await resetPresets();
    res.json(reset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Google Drive OAuth Routes
app.get('/api/drive/status', async (_req, res) => {
  const status = await getSystemStatus();
  res.json(status.drive);
});

app.post('/api/drive/configure', async (req, res) => {
  try {
    const { clientId, clientSecret, rawJson } = req.body;
    let configObj;
    if (rawJson) {
      configObj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } else if (clientId && clientSecret) {
      configObj = {
        installed: {
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          redirect_uris: [
            `http://localhost:${PORT}/api/drive/callback`,
            `http://127.0.0.1:${PORT}/api/drive/callback`
          ]
        }
      };
    } else {
      throw new Error('Please provide both Client ID and Client Secret.');
    }
    await fsp.writeFile(OAUTH_FILE, JSON.stringify(configObj, null, 2), 'utf8');
    res.json({ configured: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/youtube/connect', (req, res) => {
  try {
    const accountId = req.query.accountId || 'default';
    const redirectUri = `http://${req.headers.host || `localhost:${PORT}`}/api/drive/callback`;
    const url = getYouTubeAuthUrl(redirectUri, accountId);
    res.redirect(url);
  } catch (err) {
    res.status(400).send(`YouTube setup required: ${err.message}. Ensure your credentials are in config/google-oauth.json.`);
  }
});

app.get('/api/youtube/switch', async (req, res) => {
  try {
    const accountId = req.query.accountId || 'default';
    const specificToken = path.join(TOKENS_DIR, `${accountId}.json`);
    if (fs.existsSync(specificToken)) await fsp.unlink(specificToken);
    if (accountId === 'default' && fs.existsSync(TOKEN_FILE)) await fsp.unlink(TOKEN_FILE);

    const redirectUri = `http://${req.headers.host || `localhost:${PORT}`}/api/drive/callback`;
    const url = getYouTubeAuthUrl(redirectUri, accountId);
    res.redirect(url);
  } catch (err) {
    res.status(400).send(`YouTube switch error: ${err.message}`);
  }
});

app.post('/api/youtube/disconnect', async (req, res) => {
  try {
    const accountId = req.query.accountId;
    if (accountId) {
      const specific = path.join(TOKENS_DIR, `${accountId}.json`);
      if (fs.existsSync(specific)) await fsp.unlink(specific);
    } else {
      if (fs.existsSync(TOKEN_FILE)) await fsp.unlink(TOKEN_FILE);
    }
    res.json({ connected: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/status', (req, res) => {
  const accountId = req.query.accountId;
  let isConnected = false;
  if (accountId) {
    isConnected = fs.existsSync(path.join(TOKENS_DIR, `${accountId}.json`));
  }
  if (!isConnected) {
    isConnected = fs.existsSync(TOKEN_FILE);
  }
  res.json({ connected: isConnected });
});

app.get('/api/drive/connect', (req, res) => {
  try {
    const redirectUri = `http://${req.headers.host || `localhost:${PORT}`}/api/drive/callback`;
    const url = getAuthUrl(redirectUri);
    res.redirect(url);
  } catch (err) {
    res.status(400).send(`Google Drive setup required: ${err.message}. Place your downloaded credentials into config/google-oauth.json.`);
  }
});

app.get('/api/drive/callback', async (req, res) => {
  try {
    const redirectUri = `http://${req.headers.host || `localhost:${PORT}`}/api/drive/callback`;
    const code = String(req.query.code || '');
    const accountId = String(req.query.state || 'default');
    if (!code) throw new Error('Authorization code missing.');
    await handleCallback(code, redirectUri, accountId);
    res.redirect(`/?youtube=connected&accountId=${accountId}`);
  } catch (err) {
    res.status(500).send(`OAuth authorization error: ${err.message}`);
  }
});

app.post('/api/drive/disconnect', async (_req, res) => {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      await fsp.unlink(TOKEN_FILE);
    }
    res.json({ connected: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Job Creation & Management
app.get('/api/jobs', async (_req, res) => {
  try {
    res.json(await getJobs());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Job: Video Upload
app.post('/api/jobs/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please choose a video file.' });

    const sourcePath = req.file.path;
    const info = await getVideoInfo(sourcePath);
    let options = {};
    try {
      options = JSON.parse(req.body.options || '{}');
    } catch {}

    const job = {
      id: crypto.randomUUID(),
      sourceType: 'upload',
      sourceName: req.file.originalname,
      sourcePath,
      duration: Math.round(info.duration),
      width: info.width,
      height: info.height,
      options,
      status: 'uploaded',
      progress: { percent: 100, message: 'Upload complete.' },
      clips: [],
      outputs: [],
      createdAt: new Date().toISOString()
    };

    await saveJob(job);

    // If auto-process is requested (default), kick off transcription & moment analysis asynchronously
    if (options.autoProcess !== false) {
      processVideo(job.id, options).catch(err => {
        console.error(`Auto-processing failed for job ${job.id}:`, err);
      });
    }

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Job: Video Link (yt-dlp or direct MP4 link)
app.post('/api/jobs/url', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    if (!url) return res.status(400).json({ error: 'Please provide a valid video link.' });

    const jobId = crypto.randomUUID();
    const initialJob = {
      id: jobId,
      sourceType: 'url',
      sourceUrl: url,
      sourceName: 'Downloading...',
      sourcePath: '',
      duration: 0,
      options,
      status: 'downloading',
      progress: { percent: 0, message: 'Starting video download...' },
      clips: [],
      outputs: [],
      createdAt: new Date().toISOString()
    };

    await saveJob(initialJob);

    // Run download in background
    (async () => {
      let downloadResult = null;
      try {
        downloadResult = await downloadUrl(url, (p) => {
          updateJob(jobId, { progress: p }).catch(() => {});
        }, null, options);

        const info = await getVideoInfo(downloadResult.filePath);
        await updateJob(jobId, {
          sourceName: downloadResult.rawTitle || downloadResult.title,
          sourcePath: downloadResult.filePath,
          duration: Math.round(info.duration),
          width: info.width,
          height: info.height,
          audioOnly: Boolean(downloadResult.audioOnly),
          status: 'downloaded',
          progress: { percent: 100, message: 'Download finished.' }
        });

        if (options.autoProcess !== false) {
          await processVideo(jobId, options);
        }
      } catch (dlErr) {
        if (downloadResult?.filePath && fs.existsSync(downloadResult.filePath)) {
          try { fs.unlinkSync(downloadResult.filePath); } catch {}
        }
        await updateJob(jobId, {
          status: 'failed',
          error: dlErr.message,
          progress: { percent: 0, message: dlErr.message }
        }).catch(() => {});
      }
    })();

    res.json(initialJob);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// MAX AUTOMATE: YouTube Channel Auto-Clipper Endpoints
const { fetchChannelVideos, normalizeChannelUrl } = require('./lib/downloader');

// 1. Channel Video Preview
app.post('/api/automate/channel-preview', async (req, res) => {
  try {
    const { channelUrl, count = 5 } = req.body || {};
    if (!channelUrl) return res.status(400).json({ error: 'Please enter a YouTube Channel URL or @handle.' });

    const result = await fetchChannelVideos(channelUrl, count);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. BOOM: Auto-launch channel clipping batch
app.post('/api/automate/launch', async (req, res) => {
  try {
    const { channelUrl, count = 5, clipsPerVideo = 5, options = {} } = req.body || {};
    if (!channelUrl) return res.status(400).json({ error: 'Please enter a YouTube Channel URL or @handle.' });

    const channelData = await fetchChannelVideos(channelUrl, count);
    const videos = channelData.videos || [];
    if (!videos.length) {
      return res.status(404).json({ error: 'No videos found for this channel.' });
    }

    const createdJobs = [];

    // Helper to start job processing
    async function startJob(video) {
      const jobId = crypto.randomUUID();
      const jobOptions = {
        ratingSystem: options.ratingSystem || 'hollywood',
        ...options,
        clipCount: Math.max(1, Math.min(100, Number(clipsPerVideo) || 5)),
        streamQuality: options.streamQuality || 'turbo',
        autoProcess: true
      };

      const initialJob = {
        id: jobId,
        sourceType: 'url',
        sourceUrl: video.url,
        sourceName: video.title,
        sourcePath: '',
        thumbnail: video.thumbnail,
        channelTitle: channelData.channelTitle,
        duration: video.duration || 0,
        options: jobOptions,
        status: 'downloading',
        progress: { percent: 0, message: `[${channelData.channelTitle}] Queued for Auto-Clipping...` },
        clips: [],
        outputs: [],
        createdAt: new Date().toISOString()
      };

      await saveJob(initialJob);
      createdJobs.push(initialJob);

      // Launch background execution
      (async () => {
        let downloadResult = null;
        try {
          downloadResult = await downloadUrl(video.url, (p) => {
            updateJob(jobId, { progress: p }).catch(() => {});
          }, null, jobOptions);

          const info = await getVideoInfo(downloadResult.filePath);
          await updateJob(jobId, {
            sourceName: downloadResult.rawTitle || downloadResult.title || video.title,
            sourcePath: downloadResult.filePath,
            duration: Math.round(info.duration) || video.duration,
            width: info.width,
            height: info.height,
            audioOnly: Boolean(downloadResult.audioOnly),
            status: 'downloaded',
            progress: { percent: 100, message: 'Downloaded. Starting Whisper transcription & viral detection...' }
          });

          await processVideo(jobId, jobOptions);
        } catch (dlErr) {
          if (downloadResult?.filePath && fs.existsSync(downloadResult.filePath)) {
            try { fs.unlinkSync(downloadResult.filePath); } catch {}
          }
          await updateJob(jobId, {
            status: 'failed',
            error: dlErr.message,
            progress: { percent: 0, message: dlErr.message }
          }).catch(() => {});
        }
      })();
    }

    for (const v of videos) {
      await startJob(v);
    }

    res.json({
      success: true,
      channelTitle: channelData.channelTitle,
      queuedCount: createdJobs.length,
      jobs: createdJobs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Transcription & Best-Moment Analysis manually
app.post('/api/jobs/:id/process', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    processVideo(job.id, req.body.options || job.options).catch(err => {
      console.error(`Process video error for ${job.id}:`, err);
    });

    res.json({ message: 'Processing started.', jobId: job.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Transcript (editable transcript requirement)
app.patch('/api/jobs/:id/transcript', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const updated = await updateJob(req.params.id, {
      transcript: req.body.transcript
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Clips (title, start, end, reorder, delete, add)
app.patch('/api/jobs/:id/clips', async (req, res) => {
  try {
    const updated = await updateJob(req.params.id, {
      clips: req.body.clips,
      options: req.body.options
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record Feedback (accept, reject, adjust)
app.post('/api/jobs/:id/feedback', async (req, res) => {
  try {
    const { action, clip } = req.body;
    const fb = await recordFeedback({ action, clip, jobId: req.params.id });
    res.json({ success: true, feedback: fb });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Analyze only a selected local clip. Never accept filesystem paths from the client.
app.post('/api/jobs/:id/framing-plan', async (req,res) => {
  try {
    const job=await getJob(req.params.id);
    if(!job)return res.status(404).json({error:'Project not found.'});
    const clip=job.clips?.find(c=>c.id===req.body.clipId);
    if(!clip)return res.status(404).json({error:'Select a clip before analyzing framing.'});
    if(!job.sourcePath || !fs.existsSync(job.sourcePath))return res.status(400).json({error:'The original recording is unavailable. Import the full video before analyzing framing.'});
    const start=Number(req.body.start ?? clip.start),end=Number(req.body.end ?? clip.end);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end-start>600||(job.duration>0&&end>job.duration+.1))return res.status(400).json({error:'Select a valid clip of at most 10 minutes.'});
    const mode=req.body.mode || 'adaptive',aspect=req.body.aspect || job.options?.aspectRatio || '9:16';
    const plan=await getAdaptiveFramingPlan(job.sourcePath,start,end,aspect,mode);
    const callouts=buildSmartCallouts({...clip,start,end},job.transcript,req.body.density);
    res.json({plan,callouts,clipId:clip.id,start,end});
  }catch(err){res.status(400).json({error:err.message || 'Framing analysis failed.'});}
});

app.post('/api/jobs/:id/smart-text', async (req,res) => {
  try {
    const job=await getJob(req.params.id);
    if(!job)return res.status(404).json({error:'Project not found.'});
    const clip=job.clips?.find(c=>c.id===req.body.clipId);
    if(!clip)return res.status(404).json({error:'Select a clip first.'});
    const start=Number(req.body.start ?? clip.start),end=Number(req.body.end ?? clip.end);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end-start>600)return res.status(400).json({error:'Select a valid clip of at most 10 minutes.'});
    res.json({callouts:buildSmartCallouts({...clip,start,end},job.transcript,req.body.density)});
  }catch(err){res.status(400).json({error:err.message || 'Text suggestions failed.'});}
});

// Start Rendering
app.post('/api/jobs/:id/render', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    // Check licensing quota before rendering
    const targetClipsCount = (req.body.clips || job.clips || []).length;
    const quotaCheck = canExportClips(targetClipsCount || 1);
    if (!quotaCheck.allowed) {
      return res.status(403).json({ error: quotaCheck.message, reason: quotaCheck.reason, quota: quotaCheck });
    }

    // Update job clips and options if passed
    if (req.body.clips) {
      await updateJob(job.id, { clips: req.body.clips, options: req.body.options || job.options });
    }

    // Dynamically invalidate cache to guarantee fresh renderer without restarting server
    delete require.cache[require.resolve('./lib/job-runner')];
    delete require.cache[require.resolve('./lib/renderer')];
    const { renderJob: freshRenderJob } = require('./lib/job-runner');

    freshRenderJob(job.id, req.body.options || job.options).catch(err => {
      console.error(`Rendering error for ${job.id}:`, err?.message || err);
    });

    res.json({ message: 'Rendering started.', jobId: job.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Split stream into chronological parts (Part 1, Part 2, Part 3)
app.post('/api/jobs/:id/split-parts', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (!job.transcript) return res.status(400).json({ error: 'No transcript available to split parts.' });

    const partsCount = Math.max(2, Math.min(6, Number(req.body.partsCount) || 3));
    const totalClips = Math.max(partsCount, Number(req.body.totalClips || req.body.clipCount || 75));

    delete require.cache[require.resolve('./lib/analyzer')];
    const { splitStreamIntoParts } = require('./lib/analyzer');
    const result = splitStreamIntoParts(job.transcript, job.duration, {
      partsCount,
      totalClips,
      minDuration: 20,
      maxDuration: 65,
      ...req.body.options
    });

    await updateJob(job.id, {
      parts: result.parts,
      clips: result.clips,
      status: 'ready'
    });

    const updated = await getJob(job.id);
    res.json({
      message: `Stream split successfully into ${result.parts.length} parts with ${result.clips.length} clips.`,
      parts: updated.parts,
      clipsCount: updated.clips.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-Analyze & Score Moments for existing job with transcript
app.post('/api/jobs/:id/reanalyze', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (!job.transcript) return res.status(400).json({ error: 'No transcript available to re-score clips.' });

    const options = {
      ...job.options,
      ...req.body,
      minDuration: 20
    };

    const ratingSystem = options.ratingSystem || job.options?.ratingSystem || 'beast';
    let clips = null;

    if (ratingSystem === 'beast') {
      try {
        const { findBeastMoments } = require('./lib/beast-analyzer');
        clips = await findBeastMoments(job.transcript, job.duration, options);
      } catch (beastErr) {
        console.warn('[Beast Analyzer] Fallback in reanalyze:', beastErr.message);
      }
    } else if (ratingSystem === 'hollywood') {
      try {
        const { findHollywoodMoments } = require('./lib/hollywood-analyzer');
        clips = await findHollywoodMoments(job.transcript, job.duration, options);
      } catch (hwErr) {
        console.warn('[Hollywood Analyzer] Fallback in reanalyze:', hwErr.message);
      }
    }

    if (!clips || clips.length === 0) {
      try {
        const { analyzeWithAI } = require('./lib/ai-providers');
        clips = await analyzeWithAI(job.transcript, job.duration, options);
      } catch (aiErr) {
        console.warn('[AI Analysis] Fallback to offline analyzer:', aiErr.message);
      }
    }

    if (!clips || clips.length === 0) {
      delete require.cache[require.resolve('./lib/analyzer')];
      const { findBestMoments } = require('./lib/analyzer');
      clips = await findBestMoments(job.transcript, job.duration, options);
    }

    // Enrich clips with Hollywood scorecard
    if (clips && clips.length) {
      try {
        const { scoreHollywoodHook } = require('./lib/hollywood-analyzer');
        clips = clips.map(c => {
          if (!c.hollywood && c.hook) {
            const hw = scoreHollywoodHook(c.hook, c.title || '');
            return {
              ...c,
              hollywood: {
                score: hw.score,
                grade: hw.grade,
                speedToValue: hw.speedToValue.score,
                clarity: hw.clarity.score,
                relevance: hw.relevance.score,
                contrast: hw.contrast.score,
                tip: hw.improvementTip
              }
            };
          }
          return c;
        });
      } catch (e) {
        console.warn('[Hollywood Scorecard] Warning:', e.message);
      }
    }

    // Enrich clips with Beast scorecard
    if (clips && clips.length) {
      try {
        const { scoreBeastClip } = require('./lib/beast-analyzer');
        clips = clips.map(c => {
          if (!c.beast && (c.hook || c.title)) {
            const b = scoreBeastClip((c.title || '') + ' ' + (c.hook || ''), (c.end || 30) - (c.start || 0), job.transcript?.audio_energy);
            return {
              ...c,
              beast: {
                score: b.score,
                tier: b.tier,
                badge: b.badge,
                audioSurge: b.audioScore.score,
                twist: b.twistScore.score,
                arousal: b.arousalScore.score,
                pacing: b.pacingScore.score,
                audioTip: b.audioScore.tip,
                twistTip: b.twistScore.tip,
                arousalTip: b.arousalScore.tip,
                pacingTip: b.pacingScore.tip,
                brockHook: b.brockHook,
                preset: b.recommendedPreset
              }
            };
          }
          return c;
        });
      } catch (e) {}
    }

    const parts = clips?.parts || null;

    await updateJob(job.id, {
      clips,
      ...(parts ? { parts } : {}),
      status: 'ready'
    });

    const updated = await getJob(job.id);
    res.json(updated);
  } catch (err) {
    console.error('Error re-analyzing clips:', err);
    res.status(500).json({ error: err.message });
  }
});

// Launch Auto-Pilot Batch Mode
app.post('/api/jobs/:id/autopilot', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    runAutoPilot(job.id, req.body).catch(err => {
      console.error(`Auto-Pilot background error for ${job.id}:`, err);
    });

    res.json({ message: 'Auto-Pilot launched.', jobId: job.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id/autopilot/status', (req, res) => {
  const status = getAutoPilotStatus(req.params.id);
  res.json(status || { status: 'idle', percent: 0, message: '' });
});

// Launch Batch Post & Schedule Route (Instant Multi-Account Publish or Staggered Drip)
app.post('/api/jobs/:id/batch-post', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (!job.clips || job.clips.length === 0) {
      return res.status(400).json({ error: 'No clips discovered in this job.' });
    }

    const {
      clipIds,
      accountIds,
      filterPart, // 'all' | 1 | 2 | 3
      mode = 'instant', // 'instant' | 'drip'
      intervalMinutes = 60,
      renderOptions = {}
    } = req.body;

    // Filter clips to post
    let targetClips = job.clips;
    if (filterPart && filterPart !== 'all') {
      const pNum = Number(filterPart);
      targetClips = targetClips.filter(c => c.part === pNum || c.partIndex === pNum);
    }
    if (Array.isArray(clipIds) && clipIds.length > 0) {
      targetClips = targetClips.filter(c => clipIds.includes(c.id));
    }
    if (targetClips.length === 0) {
      return res.status(400).json({ error: 'No matching clips selected.' });
    }

    // Resolve target accounts
    let targetAccounts = accountIds;
    if (!targetAccounts || targetAccounts.length === 0) {
      const allAccs = await getAccounts();
      targetAccounts = allAccs.filter(a => a.enabled).map(a => a.id);
    }
    if (!targetAccounts || targetAccounts.length === 0) {
      targetAccounts = ['acc_2']; // Default YouTube shorts
    }

    const settings = await getSettings();
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY || null;

    const baseTime = Date.now();
    const scheduledPosts = [];
    const failedClips = [];

    for (let i = 0; i < targetClips.length; i++) {
      const clip = targetClips[i];

      // Safe hardware thermal cooldown & memory settling between batch renders for laptop stability
      if (i > 0) {
        console.log(`[Batch Post] Laptop thermal protection cooldown (2s) before clip ${i + 1}/${targetClips.length}...`);
        await new Promise(r => setTimeout(r, 2000));
      }

      try {
        console.log(`[Batch Post] Processing clip ${i + 1}/${targetClips.length}: "${clip.title}"...`);

        // Check if clip has already been rendered
        let renderedOutput = (job.outputs || []).find(o => 
          o.name?.includes(clip.title) || o.filePath?.includes(clip.id) || o.name?.startsWith(`${String(i + 1).padStart(2, '0')}-`)
        );

        // If not rendered yet, render the 9:16 vertical short now
        if (!renderedOutput) {
          delete require.cache[require.resolve('./lib/renderer')];
          const { renderClip: freshBatchRenderClip } = require('./lib/renderer');
          renderedOutput = await freshBatchRenderClip(job, clip, i, {
            ...job.options,
            ...renderOptions,
            aspectRatio: renderOptions.aspectRatio || job.options?.aspectRatio || '9:16',
            captionPreset: renderOptions.captionPreset || job.options?.captionPreset || 'viral-pop',
            framingMode: renderOptions.framingMode || job.options?.framingMode || 'smart',
            captionsEnabled: renderOptions.captionsEnabled !== false,
            autoMemes: renderOptions.autoMemes !== false,
            hookStitcher: Boolean(renderOptions.hookStitcher)
          });

          // Add to job outputs
          const currentJob = await getJob(job.id);
          const updatedOutputs = (currentJob.outputs || []).filter(o => o.name !== renderedOutput.name);
          updatedOutputs.push(renderedOutput);
          await updateJob(job.id, { outputs: updatedOutputs });
        }

        // Generate viral metadata
        const meta = await generatePostMetadata(clip.title, clip.transcriptText || clip.hook || '', 'all', apiKey);

        // Determine schedule timestamp
        const isInstant = mode === 'instant';
        const scheduledAt = isInstant 
          ? new Date(baseTime + (i * 10 * 1000)).toISOString() // Stagger by 10s for instant blast
          : new Date(baseTime + (i * intervalMinutes * 60 * 1000)).toISOString();

        const postData = {
          title: meta.title || clip.title,
          caption: meta.caption || `${clip.title} 🔥\n\nWait until you see what happens next! 👇`,
          hashtags: meta.hashtags?.length ? meta.hashtags : ['#fyp', '#viral', '#shorts', '#trending'],
          firstComment: meta.firstComment || 'Which part did you like the most? Let us know below 👇',
          clipId: clip.id,
          jobId: job.id,
          clipName: clip.title,
          videoPath: renderedOutput.filePath,
          videoUrl: renderedOutput.url,
          accountIds: targetAccounts,
          status: isInstant ? 'publishing' : 'scheduled',
          immediate: isInstant,
          scheduledAt,
          isRendered: true
        };

        const saved = await savePost(postData);

        // If instant, trigger multi-account publishing pipeline
        if (isInstant) {
          publishPost(saved.id).catch(err => {
            console.error(`Instant batch publish failed for post ${saved.id}:`, err);
          });
        }

        scheduledPosts.push(saved);
      } catch (clipErr) {
        console.error(`[Batch Post] Error on clip ${i + 1} (${clip.title}):`, clipErr.message);
        failedClips.push({ clipId: clip.id, title: clip.title, error: clipErr.message });
      }
    }

    res.json({
      success: true,
      message: mode === 'instant' 
        ? `🚀 Dispatched ${scheduledPosts.length} clips for instant publishing across ${targetAccounts.length} accounts!${failedClips.length > 0 ? ` (${failedClips.length} failed/skipped)` : ''}` 
        : `⏳ Scheduled ${scheduledPosts.length} clips with a ${intervalMinutes}-min drip delay across ${targetAccounts.length} accounts!${failedClips.length > 0 ? ` (${failedClips.length} failed/skipped)` : ''}`,
      count: scheduledPosts.length,
      failedCount: failedClips.length,
      failedClips,
      mode,
      posts: scheduledPosts
    });
  } catch (err) {
    console.error('Batch post route error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel active operation
app.post('/api/jobs/:id/cancel', async (req, res) => {
  try {
    const cancelled = cancelJob(req.params.id);
    await updateJob(req.params.id, {
      status: 'cancelled',
      progress: { percent: 0, message: 'Operation cancelled by user.' }
    });
    res.json({ cancelled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retry failed job
app.post('/api/jobs/:id/retry', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    // If source file is missing and it's a URL job, re-download
    if (job.sourceType === 'url' && (!job.sourcePath || !fs.existsSync(job.sourcePath))) {
      (async () => {
        let downloadResult = null;
        try {
          await updateJob(job.id, { status: 'downloading', error: null, progress: { percent: 0, message: 'Re-downloading video...' } });
          downloadResult = await downloadUrl(job.sourceUrl, (p) => {
            updateJob(job.id, { progress: p }).catch(() => {});
          }, null, job.options || {});
          const info = await getVideoInfo(downloadResult.filePath);
          await updateJob(job.id, {
            sourceName: downloadResult.rawTitle || downloadResult.title,
            sourcePath: downloadResult.filePath,
            duration: Math.round(info.duration),
            width: info.width,
            height: info.height,
            audioOnly: Boolean(downloadResult.audioOnly),
            status: 'downloaded',
            progress: { percent: 100, message: 'Download finished.' }
          });
          await processVideo(job.id, job.options);
        } catch (err) {
          if (downloadResult?.filePath && fs.existsSync(downloadResult.filePath)) {
            try { fs.unlinkSync(downloadResult.filePath); } catch {}
          }
          await updateJob(job.id, {
            status: 'failed',
            error: err.message,
            progress: { percent: 0, message: err.message }
          }).catch(() => {});
        }
      })();
    } else if (job.status === 'failed' && (!job.clips || job.clips.length === 0)) {
      await updateJob(job.id, { error: null });
      processVideo(job.id, job.options).catch(err => console.error(err));
    } else {
      await updateJob(job.id, { error: null });
      renderJob(job.id, job.options).catch(err => console.error(err));
    }

    res.json({ message: 'Retry initiated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete job and local files
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (job) {
      // Clean up finished batch and job directories
      if (job.batchFolder) {
        const batchDir = path.join(FINISHED, job.batchFolder);
        if (fs.existsSync(batchDir)) {
          await fsp.rm(batchDir, { recursive: true, force: true });
        }
      }
      const outDir = path.join(FINISHED, job.id);
      if (fs.existsSync(outDir)) {
        await fsp.rm(outDir, { recursive: true, force: true });
      }
      // If temporary source file still exists and delete was requested
      if (req.query.deleteSource === 'true' && job.sourcePath && fs.existsSync(job.sourcePath)) {
        await fsp.rm(job.sourcePath, { force: true });
      }
      await deleteJob(req.params.id);
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Multi-Account Post Automation & Scheduling API
// Get Accounts
app.get('/api/accounts', async (_req, res) => {
  try {
    const accounts = await getAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Account
app.post('/api/accounts', async (req, res) => {
  try {
    const account = await saveAccount(req.body);
    res.json(account);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Account
app.put('/api/accounts/:id', async (req, res) => {
  try {
    const updated = await updateAccount(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Account
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    await deleteAccount(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reset to Default High-Yield Sample Accounts (12 accounts)
app.post('/api/accounts/reset', async (_req, res) => {
  try {
    const accounts = await resetAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload Custom Video Clip directly from PC for Scheduling & Auto Upload
app.post('/api/posts/upload-clip', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please choose a video file from your computer.' });
    const info = await getVideoInfo(req.file.path);
    const cleanTitle = path.basename(req.file.originalname, path.extname(req.file.originalname))
      .replace(/^\d+[-_]/, '')
      .replace(/[-_]/g, ' ');
    res.json({
      id: `custom_${Date.now()}_${path.basename(req.file.path, path.extname(req.file.path))}`,
      title: cleanTitle,
      sourceName: req.file.originalname,
      filename: req.file.originalname,
      videoPath: req.file.path,
      videoUrl: `/incoming/${path.basename(req.file.path)}`,
      duration: Math.round(info.duration || 0),
      width: info.width || 1080,
      height: info.height || 1920,
      isRendered: true,
      isCustom: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Available Clips for Scheduling
app.get('/api/posts/available-clips', async (_req, res) => {
  try {
    const jobs = await getJobs();
    const available = [];
    const seenPaths = new Set();

    for (const job of jobs) {
      // 1. Gather all rendered outputs recorded in job.outputs
      if (Array.isArray(job.outputs)) {
        for (const out of job.outputs) {
          if (out.filePath && fs.existsSync(out.filePath) && !seenPaths.has(out.filePath)) {
            seenPaths.add(out.filePath);
            available.push({
              id: `rendered_${job.id}_${out.name || path.basename(out.filePath)}`,
              jobId: job.id,
              jobName: job.sourceName,
              title: (out.name || path.basename(out.filePath)).replace(/^\d+-/, '').replace(/\.mp4$/, '').replace(/[-_]/g, ' '),
              filename: out.name || path.basename(out.filePath),
              videoPath: out.filePath,
              videoUrl: out.url || `/media/${encodeURIComponent(job.batchFolder || job.id)}/${encodeURIComponent(out.name)}`,
              isRendered: true
            });
          }
        }
      }

      // 2. Scan both batchFolder and job.id directories in FINISHED for any unlisted clips
      const candidateDirs = [
        job.batchFolder ? path.join(FINISHED, job.batchFolder) : null,
        path.join(FINISHED, job.id)
      ].filter(Boolean);

      for (const dir of candidateDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4') && !f.startsWith('_'));
          for (const file of files) {
            const filePath = path.join(dir, file);
            if (!seenPaths.has(filePath)) {
              seenPaths.add(filePath);
              const folderName = path.basename(dir);
              available.push({
                id: `rendered_${job.id}_${file}`,
                jobId: job.id,
                jobName: job.sourceName,
                title: file.replace(/^\d+-/, '').replace(/\.mp4$/, '').replace(/[-_]/g, ' '),
                filename: file,
                videoPath: filePath,
                videoUrl: `/media/${encodeURIComponent(folderName)}/${encodeURIComponent(file)}`,
                isRendered: true
              });
            }
          }
        }
      }

      // 3. Available unrendered clip candidates from moments analysis
      if (Array.isArray(job.clips)) {
        for (const clip of job.clips) {
          available.push({
            id: `clip_${job.id}_${clip.id || clip.start}`,
            jobId: job.id,
            jobName: job.sourceName,
            title: clip.title || 'Clip Highlight',
            transcriptText: clip.transcriptText || '',
            duration: Math.round((clip.end || 0) - (clip.start || 0)),
            start: clip.start,
            end: clip.end,
            isRendered: false,
            videoPath: job.sourcePath || '',
            videoUrl: `/media/jobs/${job.id}/stream`
          });
        }
      }
    }

    res.json(available);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Scheduled Posts
app.get('/api/posts', async (_req, res) => {
  try {
    const posts = await getPosts();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Scheduled Post
app.post('/api/posts', async (req, res) => {
  try {
    const post = await savePost(req.body);

    // Auto-remember any hashtags used in this post across title, caption, and hashtags fields
    const autoTags = [];
    if (Array.isArray(req.body.hashtags)) autoTags.push(...req.body.hashtags);
    if (req.body.title) {
      const titleMatches = req.body.title.match(/#[\w\u0590-\u05ff]+/g);
      if (titleMatches) autoTags.push(...titleMatches);
    }
    if (req.body.caption) {
      const capMatches = req.body.caption.match(/#[\w\u0590-\u05ff]+/g);
      if (capMatches) autoTags.push(...capMatches);
    }
    if (autoTags.length) {
      rememberTags(autoTags).catch(e => console.error('Auto-remember tags error:', e));
    }

    // If post status is immediate, publish right away
    if (req.body.immediate === true || req.body.status === 'published') {
      publishPost(post.id).catch(err => console.error('Immediate post error:', err));
    }
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Post
app.patch('/api/posts/:id', async (req, res) => {
  try {
    const updated = await updatePost(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    await deletePost(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Manual Trigger / Publish Now
app.post('/api/posts/:id/publish', async (req, res) => {
  try {
    const result = await publishPost(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Copywriting & Hashtags Generator
app.post('/api/posts/ai-metadata', async (req, res) => {
  try {
    const { title, transcriptText, platform } = req.body;
    const settings = await getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    const meta = await generatePostMetadata(title, transcriptText, platform, apiKey);
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post Execution Logs
app.get('/api/posts/logs', async (_req, res) => {
  try {
    const logs = await getPostLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live YouTube Shorts Analytics API
app.get('/api/analytics/shorts', async (_req, res) => {
  try {
    const analytics = await getShortsAnalytics(false);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analytics/refresh', async (_req, res) => {
  try {
    const analytics = await getShortsAnalytics(true);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bind to 0.0.0.0 and listen on PORT
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` AUTOCLIPIN is active and listening`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Network URL: http://127.0.0.1:${PORT}`);
  console.log(`===============================================`);
  // Start post scheduler daemon
  initScheduler();
});

module.exports = app;

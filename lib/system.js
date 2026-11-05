const { execSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { OAUTH_FILE, TOKEN_FILE, DATA } = require('./config');
const { getSettings } = require('./db');

function runSync(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
  } catch {
    return null;
  }
}

let cachedToolVersions = null;

function getToolVersions() {
  if (cachedToolVersions) return cachedToolVersions;

  const ffmpegVer = runSync('ffmpeg -version');
  const ffprobeVer = runSync('ffprobe -version');
  const pythonVer = runSync('python --version');
  const ytdlpVer = runSync('python -m yt_dlp --version') || runSync('yt-dlp --version');
  
  // Check faster-whisper
  const whisperCheck = runSync('python -c "import faster_whisper; print(faster_whisper.__version__)"');
  
  // Check opencv
  const cvCheck = runSync('python -c "import cv2; print(cv2.__version__)"');

  cachedToolVersions = {
    ffmpeg: {
      available: Boolean(ffmpegVer),
      version: ffmpegVer ? ffmpegVer.split('\n')[0] : null
    },
    ffprobe: {
      available: Boolean(ffprobeVer),
      version: ffprobeVer ? ffprobeVer.split('\n')[0] : null
    },
    python: {
      available: Boolean(pythonVer),
      version: pythonVer || null
    },
    whisper: {
      available: Boolean(whisperCheck),
      version: whisperCheck ? `faster-whisper ${whisperCheck}` : null
    },
    opencv: {
      available: Boolean(cvCheck),
      version: cvCheck ? `opencv ${cvCheck}` : null
    },
    ytdlp: {
      available: Boolean(ytdlpVer),
      version: ytdlpVer || null
    }
  };

  return cachedToolVersions;
}

async function getSystemStatus() {
  const tools = getToolVersions();

  // Check Drive OAuth
  const oauthExists = fs.existsSync(OAUTH_FILE);
  let driveConnected = false;
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      driveConnected = Boolean(tokens && (tokens.access_token || tokens.refresh_token));
    } catch {
      driveConnected = false;
    }
  }

  // Check Gemini
  const settings = await getSettings();
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY || settings.geminiApiKey);

  // Check Disk space with native 0ms fs.statfsSync first
  let freeDiskMb = null;
  try {
    if (fs.statfsSync && fs.existsSync(DATA)) {
      const stats = fs.statfsSync(DATA);
      freeDiskMb = Math.round((stats.bavail * stats.bsize) / (1024 * 1024));
    }
  } catch {}

  // Fallback if statfsSync fails
  if (freeDiskMb === null) {
    try {
      const driveLetter = path.resolve(DATA).slice(0, 2);
      const diskOut = runSync(`powershell -NoProfile -Command "(Get-PSDrive '${driveLetter.replace(':', '')}').Free / 1MB"`);
      if (diskOut) freeDiskMb = Math.round(Number(diskOut));
    } catch {}
  }

  return {
    ...tools,
    drive: {
      oauthConfigured: oauthExists,
      connected: driveConnected
    },
    gemini: {
      configured: geminiConfigured
    },
    diskSpace: {
      freeMb: freeDiskMb,
      status: freeDiskMb === null ? 'unknown' : freeDiskMb > 2000 ? 'ok' : 'low'
    }
  };
}

module.exports = {
  getSystemStatus
};

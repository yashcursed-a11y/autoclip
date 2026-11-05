const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { INCOMING } = require('./config');
const { registerProcess, unregisterProcess, recordIncident } = require('./diagnostics');

function safeName(v) {
  return (v || 'downloaded-video')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'video';
}

const KNOWN_VIDEO_HOSTS = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'twitch.tv',
  'vimeo.com',
  'facebook.com',
  'fb.watch',
  'reddit.com'
];

function isKnownPlatformUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return KNOWN_VIDEO_HOSTS.some(domain => host === domain || host.endsWith('.' + domain));
  } catch {
    return false;
  }
}

function cleanupPartialFiles(targetPath) {
  try {
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    const dir = path.dirname(targetPath);
    const base = path.basename(targetPath, path.extname(targetPath));
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith(base) && (entry.endsWith('.part') || entry.endsWith('.ytdl') || entry.includes('.f') || entry.endsWith('.temp'))) {
          try { fs.unlinkSync(path.join(dir, entry)); } catch {}
        }
      }
    }
  } catch {}
}

const activeDownloads = new Map();

async function downloadUrl(url, onProgress, abortSignal, options = {}) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS links are supported.');
  }

  // Prevent multiple duplicate simultaneous downloads of the exact same stream URL
  const normUrl = url.trim();
  if (activeDownloads.has(normUrl)) {
    const existing = activeDownloads.get(normUrl);
    if (onProgress) onProgress({ percent: 15, message: 'Attaching to already active stream download...' });
    return existing;
  }

  const downloadPromise = (async () => {
    const fileId = crypto.randomUUID();
    const outputPath = path.join(INCOMING, `${fileId}.mp4`);

    return new Promise((resolve, reject) => {
      // Quality selection:
      // If turbo or audio_first: download lightweight audio track for instant transcription and on-demand HD clip slicing
      if (options.streamQuality === 'turbo' || options.streamQuality === 'audio_first') {
        return downloadAudioOnly(url, onProgress, abortSignal)
          .then(resolve)
          .catch(reject);
      }

      let formatStr = 'bestvideo[height<=480]+bestaudio/best[height<=480]/bestvideo[height<=720]+bestaudio/best[height<=720]/18/best';
      if (options.streamQuality === '720p' || options.streamQuality === 'hd') {
        formatStr = 'bestvideo[height<=720]+bestaudio/best[height<=720]/best';
      } else if (options.streamQuality === '360p') {
        formatStr = '18/bestvideo[height<=360]+bestaudio/best[height<=360]/best';
      }

      // Run yt-dlp unbuffered (-u) with 4 concurrent fragments (-N 4) for multi-megabyte speedup
      const args = [
        '-u',
        '-m', 'yt_dlp',
        '--newline',
        '-N', '4',
        '--no-playlist',
        '--no-simulate',
        '--retries', '10',
        '--retry-sleep', '3',
        '-f', formatStr,
        '--merge-output-format', 'mp4',
        '-o', outputPath,
        '--print', 'after_video:%(title)s',
        url
      ];

      let detectedTitle = '';
      let lastProgressPct = 0;
      let proc = spawn('python', args, { windowsHide: true });

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          try { proc.kill('SIGTERM'); } catch {}
          cleanupPartialFiles(outputPath);
          activeDownloads.delete(normUrl);
          reject(new Error('Download cancelled by user.'));
        });
      }

      let stderr = '';
      proc.stdout.on('data', data => {
        const text = data.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Enhanced Progress parsing with speed and ETA:
          // [download]  45.2% of  1.38GiB at  4.80MiB/s ETA 01:23
          const match = trimmed.match(/\[download\]\s+([\d.]+)%(?:\s+of\s+([~0-9.]+[A-Za-z]+))?(?:\s+at\s+([0-9.]+[A-Za-z]+\/s))?(?:\s+ETA\s+([0-9:]+))?/);
          if (match) {
            const pct = Math.round(parseFloat(match[1]));
            lastProgressPct = pct;
            let msg = `Downloading: ${pct}%`;
            if (match[2] && match[3]) {
              msg = `Downloading: ${pct}% of ${match[2]} (${match[3]}${match[4] ? `, ETA ${match[4]}` : ''})`;
            } else if (match[3]) {
              msg = `Downloading: ${pct}% (${match[3]})`;
            }
            if (onProgress) onProgress({ percent: lastProgressPct, message: msg });
          } else if (!trimmed.startsWith('[download]') && !trimmed.startsWith('[info]') && !detectedTitle) {
            detectedTitle = trimmed;
          }
        }
      });

      proc.stderr.on('data', data => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        cleanupPartialFiles(outputPath);
        activeDownloads.delete(normUrl);
        // If python yt-dlp command failed and it's not a video platform, try direct fetch
        if (!isKnownPlatformUrl(url)) {
          tryDirectFetch(url, outputPath, onProgress)
            .then(resolve)
            .catch(() => reject(err));
        } else {
          reject(err);
        }
      });

      proc.on('close', async (code) => {
        activeDownloads.delete(normUrl);
        if (code === 0 && fs.existsSync(outputPath)) {
          try {
            const st = await fsp.stat(outputPath);
            if (st.size > 1024) {
              return resolve({
                filePath: outputPath,
                title: detectedTitle ? safeName(detectedTitle) : safeName(path.basename(parsed.pathname) || 'video'),
                rawTitle: detectedTitle || path.basename(parsed.pathname) || 'Web Video'
              });
            }
          } catch {}
        }

        // Cleanup any corrupted 0-byte or partial file
        cleanupPartialFiles(outputPath);

        // If yt-dlp fails on known platforms, report real error directly (do not download HTML page)
        if (isKnownPlatformUrl(url)) {
          const cleanErr = stderr.split('\n').filter(l => l.includes('ERROR:') || l.includes('Traceback')).join(' ') || stderr.slice(-300);
          return reject(new Error(`Download failed: ${cleanErr || 'Video stream could not be extracted.'}`));
        }

        // If generic direct mp4 URL where yt-dlp had extractor issues, try direct HTTP fetch
        try {
          const directResult = await tryDirectFetch(url, outputPath, onProgress);
          return resolve(directResult);
        } catch (fallbackErr) {
          cleanupPartialFiles(outputPath);
          reject(new Error(`Download failed: ${stderr.slice(-300) || fallbackErr.message}`));
        }
      });
    });
  })();

  activeDownloads.set(normUrl, downloadPromise);
  downloadPromise.finally(() => {
    activeDownloads.delete(normUrl);
  });
  return downloadPromise;
}

async function tryDirectFetch(url, outputPath, onProgress) {
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`HTTP fetch failed with status ${resp.status}`);
  }
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new Error('URL returned an HTML webpage or JSON rather than a direct video stream. yt-dlp was unable to extract the stream.');
  }
  
  const contentLength = Number(resp.headers.get('content-length') || 0);
  const fileStream = fs.createWriteStream(outputPath);
  
  if (!resp.body) throw new Error('Response body empty.');
  const reader = resp.body.getReader();
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
      receivedBytes += value.length;
      if (contentLength > 0 && onProgress) {
        const pct = Math.round((receivedBytes / contentLength) * 100);
        onProgress({ percent: pct, message: `Downloading: ${pct}%` });
      }
    }
    await new Promise((r, rejectStream) => {
      fileStream.on('error', rejectStream);
      fileStream.end(r);
    });
  } catch (streamErr) {
    try { fileStream.destroy(); } catch {}
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    throw streamErr;
  }

  const st = await fsp.stat(outputPath);
  if (st.size < 1024) {
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    throw new Error('Downloaded file was empty or corrupted.');
  }

  return {
    filePath: outputPath,
    title: safeName(path.basename(new URL(url).pathname) || 'downloaded-video'),
    rawTitle: path.basename(new URL(url).pathname) || 'Downloaded Video'
  };
}

async function downloadAudioOnly(url, onProgress, abortSignal) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS links are supported.');
  }

  const fileId = crypto.randomUUID();
  const outputPath = path.join(INCOMING, `${fileId}.m4a`);

  return new Promise((resolve, reject) => {
    const args = [
      '-u',
      '-m', 'yt_dlp',
      '--newline',
      '-N', '4',
      '--no-playlist',
      '--no-simulate',
      '--retries', '10',
      '--retry-sleep', '3',
      '-f', 'ba[ext=m4a]/ba/bestaudio',
      '-o', outputPath,
      '--print', 'after_video:%(title)s',
      url
    ];

    let detectedTitle = '';
    let proc = spawn('python', args, { windowsHide: true });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        try { proc.kill('SIGTERM'); } catch {}
        cleanupPartialFiles(outputPath);
        reject(new Error('Audio download cancelled by user.'));
      });
    }

    let stderr = '';
    proc.stdout.on('data', data => {
      const text = data.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/\[download\]\s+([\d.]+)%(?:\s+of\s+([~0-9.]+[A-Za-z]+))?(?:\s+at\s+([0-9.]+[A-Za-z]+\/s))?(?:\s+ETA\s+([0-9:]+))?/);
        if (match) {
          const pct = Math.round(parseFloat(match[1]));
          let msg = `Downloading audio track: ${pct}%`;
          if (match[2] && match[3]) {
            msg = `Downloading audio track: ${pct}% of ${match[2]} (${match[3]}${match[4] ? `, ETA ${match[4]}` : ''})`;
          }
          if (onProgress) onProgress({ percent: pct, message: msg });
        } else if (!trimmed.startsWith('[download]') && !trimmed.startsWith('[info]') && !detectedTitle) {
          detectedTitle = trimmed;
        }
      }
    });

    proc.stderr.on('data', data => stderr += data.toString());

    proc.on('error', err => {
      cleanupPartialFiles(outputPath);
      reject(err);
    });

    proc.on('close', async code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        try {
          const st = await fsp.stat(outputPath);
          if (st.size > 1024) {
            return resolve({
              filePath: outputPath,
              audioOnly: true,
              title: detectedTitle ? safeName(detectedTitle) : safeName(path.basename(parsed.pathname) || 'audio'),
              rawTitle: detectedTitle || path.basename(parsed.pathname) || 'Web Stream Audio'
            });
          }
        } catch {}
      }

      cleanupPartialFiles(outputPath);
      const cleanErr = stderr.split('\n').filter(l => l.includes('ERROR:') || l.includes('Traceback')).join(' ') || stderr.slice(-300);
      reject(new Error(`Audio stream extraction failed: ${cleanErr || 'Failed to download stream audio.'}`));
    });
  });
}

async function downloadClipSection(url, startSec, endSec, outputPath, options = {}) {
  const formatTime = (s) => {
    const sec = Math.max(0, Number(s) || 0);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timeRange = `*${formatTime(startSec)}-${formatTime(endSec)}`;
  const args = [
    '-u',
    '-m', 'yt_dlp',
    '--newline',
    '--no-playlist',
    '--no-simulate',
    '--retries', '10',
    '--retry-sleep', '3',
    '--download-sections', timeRange,
    '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
    '--merge-output-format', 'mp4',
    '-o', outputPath,
    url
  ];

  return new Promise((resolve, reject) => {
    let stderr = '';
    const proc = spawn('python', args, { windowsHide: true });
    registerProcess('yt-dlp', proc, { command: 'yt-dlp section slice', outputFile: outputPath, timeRange });
    proc.stderr.on('data', data => stderr += data.toString());
    proc.on('error', err => {
      unregisterProcess(proc);
      cleanupPartialFiles(outputPath);
      recordIncident({
        type: 'DOWNLOAD_FAILURE',
        title: 'yt-dlp HD Slice Process Error',
        message: err.message,
        details: timeRange,
        severity: 'WARNING'
      });
      reject(err);
    });
    proc.on('close', code => {
      unregisterProcess(proc);
      if (code === 0 && fs.existsSync(outputPath)) {
        return resolve({ filePath: outputPath });
      }
      cleanupPartialFiles(outputPath);
      const errMsg = `Failed to slice HD clip section (${timeRange}): ${stderr.slice(-300)}`;
      recordIncident({
        type: 'DOWNLOAD_FAILURE',
        title: `yt-dlp section slice failed (code ${code})`,
        message: errMsg,
        details: stderr,
        severity: 'WARNING'
      });
      reject(new Error(errMsg));
    });
  });
}

module.exports = {
  downloadUrl,
  downloadAudioOnly,
  downloadClipSection,
  safeName
};

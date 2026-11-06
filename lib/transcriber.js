const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, TRANSCRIPTS } = require('./config');
const { registerProcess, unregisterProcess } = require('./diagnostics');
const { getPythonCommand, getScriptPath } = require('./python-helper');

async function getFileHash(filePath) {
  const stat = await fsp.stat(filePath);
  // Hash file size + first 2MB + last 2MB for speed on multi-gigabyte video files
  const hash = crypto.createHash('sha256');
  hash.update(String(stat.size));
  
  const fd = await fsp.open(filePath, 'r');
  try {
    const headBuf = Buffer.alloc(Math.min(2 * 1024 * 1024, stat.size));
    await fd.read(headBuf, 0, headBuf.length, 0);
    hash.update(headBuf);

    if (stat.size > 2 * 1024 * 1024) {
      const tailBuf = Buffer.alloc(Math.min(2 * 1024 * 1024, stat.size));
      const pos = Math.max(0, stat.size - tailBuf.length);
      await fd.read(tailBuf, 0, tailBuf.length, pos);
      hash.update(tailBuf);
    }
  } finally {
    await fd.close();
  }
  return hash.digest('hex');
}

function getCachePath(hash) {
  return path.join(TRANSCRIPTS, `${hash}.json`);
}

async function getCachedTranscript(filePath) {
  try {
    const hash = await getFileHash(filePath);
    const cacheFile = getCachePath(hash);
    if (fs.existsSync(cacheFile)) {
      const data = JSON.parse(await fsp.readFile(cacheFile, 'utf8'));
      return { transcript: data, hash, fromCache: true };
    }
    return { transcript: null, hash, fromCache: false };
  } catch {
    return { transcript: null, hash: null, fromCache: false };
  }
}

async function saveTranscriptCache(hash, transcript) {
  if (!hash) return;
  const cacheFile = getCachePath(hash);
  await fsp.writeFile(cacheFile, JSON.stringify(transcript, null, 2), 'utf8');
}

async function transcribeVideo(filePath, options = {}, onProgress = null, abortSignal = null) {
  const modelSize = options.whisperModel || 'tiny';
  const language = options.language || 'auto';
  const forceRefresh = Boolean(options.forceRefresh);

  // Check cache unless forced
  const { transcript: cached, hash } = await getCachedTranscript(filePath);
  if (cached && !forceRefresh) {
    if (onProgress) onProgress({ percent: 100, message: 'Loaded transcript from cache.' });
    return { ...cached, fromCache: true, hash };
  }

  const scriptPath = getScriptPath('transcribe.py');

  return new Promise((resolve, reject) => {
    const args = [scriptPath, filePath, modelSize, language];
    const proc = spawn(getPythonCommand(), args, { windowsHide: true });
    registerProcess('whisper', proc, { command: `Whisper (${modelSize})`, filePath, language });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        try { proc.kill('SIGTERM'); } catch {}
        unregisterProcess(proc);
        reject(new Error('Transcription cancelled.'));
      });
    }

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let finalJson = null;
    let capturedError = null;

    proc.stdout.on('data', data => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop(); // keep remainder

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === 'progress') {
            if (onProgress) onProgress(parsed);
          } else if (parsed.error) {
            capturedError = parsed.error;
          } else if (parsed.segments !== undefined) {
            finalJson = parsed;
          }
        } catch {}
      }
    });

    proc.stderr.on('data', data => {
      stderrBuffer += data.toString();
    });

    proc.on('close', async (code) => {
      unregisterProcess(proc);
      if (stdoutBuffer.trim()) {
        try {
          const parsed = JSON.parse(stdoutBuffer.trim());
          if (parsed.error) capturedError = parsed.error;
          if (parsed.segments !== undefined) finalJson = parsed;
        } catch {}
      }

      if (code === 0 && finalJson) {
        finalJson.fromCache = false;
        finalJson.hash = hash;
        await saveTranscriptCache(hash, finalJson);
        return resolve(finalJson);
      }

      const errMsg = capturedError || (stderrBuffer.trim() ? stderrBuffer.slice(-300) : `Transcription process exited with code ${code}.`);
      reject(new Error(errMsg));
    });

    proc.on('error', (err) => {
      unregisterProcess(proc);
      reject(new Error(`Failed to start transcription script: ${err.message}`));
    });
  });
}

module.exports = {
  getFileHash,
  getCachedTranscript,
  saveTranscriptCache,
  transcribeVideo
};

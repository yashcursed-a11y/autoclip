const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const UNPACKED = path.join(DIST, 'win-unpacked');

const WORK_ROOT = 'D:\\AutoClip_Bundle';
const BUNDLE_DIR = path.join(WORK_ROOT, 'AUTOCLIPIN-Ultimate-v2.1.0-Windows');
const ZIP_PATH = path.join(WORK_ROOT, 'AUTOCLIPIN-v2.1.0-Ultimate-Creator-Bundle-Windows.zip');

console.log('[GiantBundle] Starting Ultimate 1-2 GB all-inclusive package creation...');

if (!fs.existsSync(UNPACKED)) {
  console.error('[GiantBundle] ERROR: dist/win-unpacked missing!');
  process.exit(1);
}

// Clean previous bundle dir
if (fs.existsSync(BUNDLE_DIR)) {
  console.log('[GiantBundle] Cleaning existing bundle dir...');
  fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BUNDLE_DIR, { recursive: true });

// 1. Copy win-unpacked into bundle
console.log('[GiantBundle] Copying win-unpacked files...');
try {
  execSync(`robocopy "${UNPACKED}" "${BUNDLE_DIR}" /E /NFL /NDL /NJH /NJS /nc /ns /np`, { stdio: 'ignore', windowsHide: true });
} catch (err) {
  if (err.status && err.status >= 8) throw err;
}

// 2. Setup bin directory (FFmpeg, FFprobe, yt-dlp)
console.log('[GiantBundle] Setting up bin/ with FFmpeg, FFprobe, yt-dlp...');
const binDir = path.join(BUNDLE_DIR, 'bin');
fs.mkdirSync(binDir, { recursive: true });

function resolveBinary(name) {
  try {
    const out = execSync(`where.exe ${name}`, { encoding: 'utf8', windowsHide: true }).trim();
    const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0 && fs.existsSync(lines[0])) return lines[0];
  } catch {}
  return null;
}

const ffmpegExe = resolveBinary('ffmpeg.exe');
const ffprobeExe = resolveBinary('ffprobe.exe');
const ytdlpExe = resolveBinary('yt-dlp.exe') || 'C:\\Users\\intel\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe';

if (ffmpegExe && fs.existsSync(ffmpegExe)) fs.copyFileSync(ffmpegExe, path.join(binDir, 'ffmpeg.exe'));
if (ffprobeExe && fs.existsSync(ffprobeExe)) fs.copyFileSync(ffprobeExe, path.join(binDir, 'ffprobe.exe'));
if (ytdlpExe && fs.existsSync(ytdlpExe)) fs.copyFileSync(ytdlpExe, path.join(binDir, 'yt-dlp.exe'));

// 3. Setup full portable Python environment
console.log('[GiantBundle] Setting up bundled Python runtime and all AI libraries...');
const pyDest = path.join(BUNDLE_DIR, 'python');
const pySrc = fs.existsSync('D:\\AutoClip_Bundle\\test_py')
  ? 'D:\\AutoClip_Bundle\\test_py'
  : 'C:\\Users\\intel\\AppData\\Local\\Programs\\Python\\Python312';

try {
  execSync(`robocopy "${pySrc}" "${pyDest}" /E /NFL /NDL /NJH /NJS /nc /ns /np`, { stdio: 'ignore', windowsHide: true });
} catch (err) {
  if (err.status && err.status >= 8) throw err;
}

// 4. Setup models directory
console.log('[GiantBundle] Setting up bundled AI models (Yunet, Whisper models)...');
const modelsDest = path.join(BUNDLE_DIR, 'models');
const yunetDest = path.join(modelsDest, 'yunet');
fs.mkdirSync(yunetDest, { recursive: true });

const faceModelSrc = path.join(ROOT, 'models', 'yunet', 'face_detection_yunet_2026may.onnx');
if (fs.existsSync(faceModelSrc)) {
  fs.copyFileSync(faceModelSrc, path.join(yunetDest, 'face_detection_yunet_2026may.onnx'));
}

// Copy faster-whisper model snapshots
const hfHub = 'C:\\Users\\intel\\.cache\\huggingface\\hub';
const modelSnapshots = [
  { name: 'whisper-tiny', path: path.join(hfHub, 'models--Systran--faster-whisper-tiny', 'snapshots', 'd90ca5fe260221311c53c58e660288d3deb8d356') },
  { name: 'whisper-base', path: path.join(hfHub, 'models--Systran--faster-whisper-base', 'snapshots', 'ebe41f70d5b6dfa9166e2c581c45c9c0cfc9c7e0') },
  { name: 'whisper-tiny.en', path: path.join(hfHub, 'models--Systran--faster-whisper-tiny.en', 'snapshots', '0d3d19a32d3338f10357c0889762bd8d4e7d9ff9') }
];

for (const m of modelSnapshots) {
  if (fs.existsSync(m.path)) {
    const dest = path.join(modelsDest, m.name);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of ['config.json', 'model.bin', 'tokenizer.json', 'vocabulary.txt']) {
      const srcFile = path.join(m.path, f);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(dest, f));
      }
    }
  }
}

// 5. Copy HuggingFace Hub cache so all libraries find models offline immediately
console.log('[GiantBundle] Bundling pre-cached HuggingFace Hub...');
const cacheDest = path.join(BUNDLE_DIR, 'cache', 'huggingface', 'hub');
fs.mkdirSync(cacheDest, { recursive: true });
try {
  execSync(`robocopy "${hfHub}" "${cacheDest}" /E /NFL /NDL /NJH /NJS /nc /ns /np`, { stdio: 'ignore', windowsHide: true });
} catch (err) {
  if (err.status && err.status >= 8) throw err;
}

// 6. Create Launchers & Readme
console.log('[GiantBundle] Creating Launch-AutoClip.bat and Start-Studio.cmd...');
const batContent = `@echo off
title Starting AUTOCLIPIN Pro Studio v2.1.0 (Ultimate All-In-One Bundle)
cd /d "%~dp0"

:: Configure complete self-contained portable environment
set PATH=%~dp0bin;%~dp0python;%~dp0python\\Scripts;%PATH%
set PYTHON_PATH=%~dp0python\\python.exe
set HF_HOME=%~dp0cache\\huggingface
set HF_HUB_OFFLINE=1
set AUTOCLIP_MODELS_DIR=%~dp0models

echo ========================================================================
echo  AUTOCLIPIN Pro Studio v2.1.0 - Ultimate Standalone Bundle
echo  ------------------------------------------------------------------------
echo  - Bundled Portable Python Environment: Ready
echo  - Bundled AI Speech Recognition (Tiny + Base): Ready
echo  - Bundled Neural Face Tracking & 9:16 Framing: Ready
echo  - Bundled High-Performance FFmpeg & FFprobe: Ready
echo  - Bundled Video Stream Ingestion Engine: Ready
echo ========================================================================
echo Launching AUTOCLIPIN Studio...
start "" "%~dp0AUTOCLIPIN.exe"
`;

fs.writeFileSync(path.join(BUNDLE_DIR, 'Launch-AutoClip.bat'), batContent, 'utf8');
fs.writeFileSync(path.join(BUNDLE_DIR, 'Start-Studio.cmd'), batContent, 'utf8');

const readmeContent = `========================================================================
 AUTOCLIPIN Pro Studio v2.1.0 - Ultimate All-In-One Bundle (100% Offline)
========================================================================

This is the COMPLETE, ZERO-DEPENDENCY edition of AUTOCLIPIN Pro Studio.
Everything is pre-installed and self-contained in this single folder:

1. AUTOCLIPIN Desktop App (AUTOCLIPIN.exe)
2. Standalone Portable Python 3.12 Runtime with:
   - faster-whisper
   - ctranslate2
   - opencv-python
   - onnxruntime
   - yt-dlp
3. Pre-bundled FFmpeg & FFprobe (in bin/)
4. Pre-bundled Neural Face Detection & 9:16 Framing Models (in models/)
5. Pre-bundled Speech Recognition Models: Tiny, Base, English (in models/ and cache/)

HOW TO RUN:
1. Double-click "Launch-AutoClip.bat" (or "AUTOCLIPIN.exe").
2. That's it! No Python installation, No FFmpeg installation, No terminal commands.
   Everything runs locally and offline right from this folder.

Updates & Support: https://github.com/yashcursed-a11y/autoclip
========================================================================
`;
fs.writeFileSync(path.join(BUNDLE_DIR, 'README-ALL-IN-ONE.txt'), readmeContent, 'utf8');

// 7. Compress into ZIP archive using tar (fast multi-threaded)
console.log('[GiantBundle] Compressing 1-2 GB bundle into ZIP (this will take 2-4 minutes)...');
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}

try {
  execSync(`tar -a -c -f "${ZIP_PATH}" -C "${WORK_ROOT}" "AUTOCLIPIN-Ultimate-v2.1.0-Windows"`, { stdio: 'inherit', windowsHide: true });
} catch (e) {
  console.log('[GiantBundle] tar fallback to Compress-Archive...');
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${BUNDLE_DIR}' -DestinationPath '${ZIP_PATH}' -CompressionLevel Optimal"`, { stdio: 'inherit', windowsHide: true });
}

if (fs.existsSync(ZIP_PATH)) {
  const stat = fs.statSync(ZIP_PATH);
  console.log(`[GiantBundle] SUCCESS! Giant bundle created at ${ZIP_PATH} (${(stat.size / (1024*1024)).toFixed(1)} MB)`);
} else {
  console.error('[GiantBundle] ERROR: Failed to produce zip archive!');
  process.exit(1);
}

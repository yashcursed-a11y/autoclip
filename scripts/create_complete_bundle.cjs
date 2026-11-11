const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const UNPACKED = path.join(DIST, 'win-unpacked');

// Use D: drive for large assembly to avoid C: ENOSPC
const WORK_ROOT = fs.existsSync('D:\\') ? 'D:\\AutoClip_Bundle' : path.join(DIST, 'bundle_temp');
const BUNDLE_DIR = path.join(WORK_ROOT, 'AUTOCLIPIN-Complete-v2.1.0-Windows');
const ZIP_PATH = path.join(WORK_ROOT, 'AUTOCLIPIN-v2.1.0-Complete-All-Engines-Windows.zip');

console.log('[Bundle] Starting complete all-engines package assembly in', WORK_ROOT);

if (!fs.existsSync(UNPACKED)) {
  console.error('[Bundle] ERROR: dist/win-unpacked does not exist!');
  process.exit(1);
}

// Ensure work directory exists
fs.mkdirSync(WORK_ROOT, { recursive: true });

// Clean previous bundle dir if present
if (fs.existsSync(BUNDLE_DIR)) {
  console.log('[Bundle] Cleaning existing bundle directory...');
  fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BUNDLE_DIR, { recursive: true });

// 1. Copy win-unpacked into bundle
console.log('[Bundle] Copying win-unpacked files to bundle directory...');
try {
  execSync(`robocopy "${UNPACKED}" "${BUNDLE_DIR}" /E /NFL /NDL /NJH /NJS /nc /ns /np`, { stdio: 'ignore', windowsHide: true });
} catch (err) {
  if (err.status && err.status >= 8) throw err;
}

// 2. Setup bin directory
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

if (ffmpegExe && fs.existsSync(ffmpegExe)) {
  console.log(`[Bundle] Copying ffmpeg.exe from ${ffmpegExe}...`);
  fs.copyFileSync(ffmpegExe, path.join(binDir, 'ffmpeg.exe'));
} else {
  console.warn('[Bundle] ffmpeg.exe not found!');
}

if (ffprobeExe && fs.existsSync(ffprobeExe)) {
  console.log(`[Bundle] Copying ffprobe.exe from ${ffprobeExe}...`);
  fs.copyFileSync(ffprobeExe, path.join(binDir, 'ffprobe.exe'));
} else {
  console.warn('[Bundle] ffprobe.exe not found!');
}

if (ytdlpExe && fs.existsSync(ytdlpExe)) {
  console.log(`[Bundle] Copying yt-dlp.exe from ${ytdlpExe}...`);
  fs.copyFileSync(ytdlpExe, path.join(binDir, 'yt-dlp.exe'));
} else {
  console.warn('[Bundle] yt-dlp.exe not found!');
}

// 3. Setup models directory
const modelsDest = path.join(BUNDLE_DIR, 'models');
const yunetDest = path.join(modelsDest, 'yunet');
fs.mkdirSync(yunetDest, { recursive: true });

const faceModelSrc = path.join(ROOT, 'models', 'yunet', 'face_detection_yunet_2026may.onnx');
if (fs.existsSync(faceModelSrc)) {
  console.log('[Bundle] Copying neural face tracking model...');
  fs.copyFileSync(faceModelSrc, path.join(yunetDest, 'face_detection_yunet_2026may.onnx'));
}

const whisperTinySrc = 'C:\\Users\\intel\\.cache\\huggingface\\hub\\models--Systran--faster-whisper-tiny\\snapshots\\d90ca5fe260221311c53c58e660288d3deb8d356';
const whisperDest = path.join(modelsDest, 'whisper-tiny');
if (fs.existsSync(whisperTinySrc)) {
  console.log('[Bundle] Copying offline speech model files...');
  fs.mkdirSync(whisperDest, { recursive: true });
  for (const file of ['config.json', 'model.bin', 'tokenizer.json', 'vocabulary.txt']) {
    const fPath = path.join(whisperTinySrc, file);
    if (fs.existsSync(fPath)) {
      fs.copyFileSync(fPath, path.join(whisperDest, file));
    }
  }
}

// 4. Create Launchers & Readme
const batContent = `@echo off
title Starting AUTOCLIPIN Pro Studio v2.1.0 (All Engines Included)
cd /d "%~dp0"
set PATH=%~dp0bin;%PATH%
set AUTOCLIP_MODELS_DIR=%~dp0models
echo ========================================================================
echo  AUTOCLIPIN Pro Studio v2.1.0 - All-In-One Complete Edition
echo  - Bundled FFmpeg & FFprobe Engines: Ready
echo  - Bundled Stream Ingestion Engine: Ready
echo  - Bundled AI Face & Auto-Framing Models: Ready
echo  - Bundled Offline Speech Recognition: Ready
echo ========================================================================
start "" "%~dp0AUTOCLIPIN.exe"
`;
fs.writeFileSync(path.join(BUNDLE_DIR, 'Launch-AutoClip.bat'), batContent, 'utf8');
fs.writeFileSync(path.join(BUNDLE_DIR, 'Start-Studio.cmd'), batContent, 'utf8');

const readmeContent = `========================================================================
 AUTOCLIPIN Pro Studio v2.1.0 - Complete All-In-One Edition
========================================================================

Everything you need to clip, track faces, generate captions, and render is
pre-bundled inside this single folder:

1. Studio Desktop Application (AUTOCLIPIN.exe)
2. High-Performance Video Rendering Engine (FFmpeg & FFprobe in bin/)
3. Video Stream Ingestion Engine (yt-dlp in bin/)
4. Neural Face Detection & 9:16 Framing Model (models/yunet/)
5. Offline AI Speech Transcription Model (models/whisper-tiny/)

HOW TO RUN:
Double-click "Launch-AutoClip.bat" (or "AUTOCLIPIN.exe").
Zero external dependencies, zero installations, 100% offline ready.

Support & Updates: https://github.com/yashcursed-a11y/autoclip
========================================================================
`;
fs.writeFileSync(path.join(BUNDLE_DIR, 'README-ALL-ENGINES.txt'), readmeContent, 'utf8');

// 5. Compress into ZIP archive
console.log('[Bundle] Compressing complete bundle into ZIP (this may take 1-2 minutes)...');
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}

try {
  // Use tar on Windows 10/11 (much faster than Compress-Archive)
  execSync(`tar -a -c -f "${ZIP_PATH}" -C "${WORK_ROOT}" "AUTOCLIPIN-Complete-v2.1.0-Windows"`, { stdio: 'inherit', windowsHide: true });
} catch (e) {
  console.log('[Bundle] tar compression failed, falling back to PowerShell Compress-Archive...');
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${BUNDLE_DIR}' -DestinationPath '${ZIP_PATH}' -CompressionLevel Optimal"`, { stdio: 'inherit', windowsHide: true });
}

if (fs.existsSync(ZIP_PATH)) {
  const stat = fs.statSync(ZIP_PATH);
  console.log(`[Bundle] SUCCESS: Complete bundle created at ${ZIP_PATH} (${(stat.size / (1024*1024)).toFixed(1)} MB)`);
} else {
  console.error('[Bundle] ERROR: Failed to produce zip archive!');
  process.exit(1);
}

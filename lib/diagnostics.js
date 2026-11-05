const os = require('node:os');
const fs = require('node:fs');
const fsp = require('node:fs').promises;
const path = require('node:path');
const { execSync, spawn } = require('node:child_process');
const { DATA, FINISHED } = require('./config');

const INCIDENTS_FILE = path.join(DATA, 'incidents.json');
const MAX_LOGS = 250;
const MAX_INCIDENTS = 50;

// In-memory telemetry stores
const recentLogs = [];
const activeProcesses = new Map(); // pid -> { pid, type, meta, startTime, child }
let incidentsCache = null;
let loggerInitialized = false;

// Format duration
function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const remainingS = s % 60;
  if (m === 0) return `${remainingS}s`;
  const h = Math.floor(m / 60);
  const remainingM = m % 60;
  if (h === 0) return `${m}m ${remainingS}s`;
  return `${h}h ${remainingM}m`;
}

// 1. Initialize Log Interceptor
function initLogger() {
  if (loggerInitialized) return;
  loggerInitialized = true;

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  function pushLog(level, args) {
    const message = args.map(a => {
      if (a instanceof Error) return a.message + (a.stack ? '\n' + a.stack : '');
      if (typeof a === 'object' && a !== null) {
        if (a.message) return a.message + (a.stack ? '\n' + a.stack : '');
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    }).join(' ');

    const logItem = {
      timestamp: new Date().toISOString(),
      time: Date.now(),
      level, // 'INFO' | 'WARN' | 'ERROR'
      message: message.slice(0, 1000)
    };
    recentLogs.push(logItem);
    if (recentLogs.length > MAX_LOGS) {
      recentLogs.shift();
    }
  }

  console.log = function(...args) {
    pushLog('INFO', args);
    origLog.apply(console, args);
  };

  console.warn = function(...args) {
    pushLog('WARN', args);
    origWarn.apply(console, args);
  };

  console.error = function(...args) {
    pushLog('ERROR', args);
    origError.apply(console, args);
  };
}

// 2. Process Registry
function registerProcess(type, child, meta = {}) {
  if (!child || !child.pid) return;
  const pid = child.pid;
  const record = {
    pid,
    type, // 'ffmpeg' | 'yt-dlp' | 'python' | 'worker'
    meta: {
      ...meta,
      command: meta.command || type,
      clipTitle: meta.clipTitle || meta.title || null,
      outputFile: meta.outputFile || null,
      jobId: meta.jobId || null
    },
    startTime: Date.now(),
    child
  };
  activeProcesses.set(pid, record);

  child.once('close', () => activeProcesses.delete(pid));
  child.once('error', () => activeProcesses.delete(pid));
  return record;
}

function unregisterProcess(childOrPid) {
  const pid = typeof childOrPid === 'object' ? childOrPid.pid : childOrPid;
  if (pid) activeProcesses.delete(pid);
}

// Query OS for live process details via tasklist
function getOsProcesses() {
  try {
    const raw = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const targetNames = ['ffmpeg.exe', 'yt-dlp.exe', 'python.exe', 'node.exe'];
    const matched = [];

    for (const line of lines) {
      // CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
      const parts = line.split('","').map(s => s.replace(/(^"|"$)/g, '').trim());
      if (parts.length >= 5) {
        const imageName = parts[0].toLowerCase();
        const pid = parseInt(parts[1], 10);
        const memStr = parts[4] || '0 K';
        const memKb = parseInt(memStr.replace(/[^0-9]/g, ''), 10) || 0;

        if (targetNames.includes(imageName)) {
          matched.push({
            imageName,
            pid,
            memMb: Math.round(memKb / 1024 * 10) / 10
          });
        }
      }
    }
    return matched;
  } catch {
    return [];
  }
}

// Get unified live backend processes
function getActiveProcesses() {
  const osProcs = getOsProcesses();
  const osProcMap = new Map(osProcs.map(p => [p.pid, p]));
  const results = [];

  // Registered processes
  for (const [pid, p] of activeProcesses.entries()) {
    const osInfo = osProcMap.get(pid);
    const durationSec = Math.round((Date.now() - p.startTime) / 1000);
    results.push({
      pid,
      type: p.type,
      name: osInfo ? osInfo.imageName : `${p.type}.exe`,
      isManaged: true,
      durationSec,
      durationStr: formatDuration(durationSec),
      memMb: osInfo ? osInfo.memMb : null,
      meta: p.meta,
      title: p.meta.clipTitle || p.meta.jobId || p.type
    });
  }

  // OS unmanaged ffmpeg or yt-dlp processes
  for (const osP of osProcs) {
    if (!activeProcesses.has(osP.pid)) {
      if (osP.imageName === 'ffmpeg.exe' || osP.imageName === 'yt-dlp.exe') {
        results.push({
          pid: osP.pid,
          type: osP.imageName.replace('.exe', ''),
          name: osP.imageName,
          isManaged: false,
          durationSec: null,
          durationStr: 'Running',
          memMb: osP.memMb,
          meta: {},
          title: `External ${osP.imageName}`
        });
      }
    }
  }

  return results;
}

// Kill a specific process
function killProcess(pid) {
  const numericPid = Number(pid);
  if (!numericPid || isNaN(numericPid)) throw new Error('Invalid PID');

  // Try managed child first
  const managed = activeProcesses.get(numericPid);
  if (managed && managed.child) {
    try {
      managed.child.kill('SIGTERM');
    } catch {}
    activeProcesses.delete(numericPid);
  }

  // Force kill via Windows taskkill
  try {
    execSync(`taskkill /PID ${numericPid} /F /T`, { stdio: 'ignore', windowsHide: true });
    return { success: true, pid: numericPid };
  } catch (err) {
    return { success: false, pid: numericPid, message: err.message };
  }
}

// Emergency stop all active renders and downloaders
function emergencyStop() {
  const killed = [];

  // Kill managed
  for (const [pid, p] of activeProcesses.entries()) {
    try {
      p.child.kill('SIGKILL');
      killed.push({ pid, type: p.type });
    } catch {}
    activeProcesses.delete(pid);
  }

  // Kill any running ffmpeg or yt-dlp by name
  try {
    execSync('taskkill /IM ffmpeg.exe /F /T', { stdio: 'ignore', windowsHide: true });
  } catch {}
  try {
    execSync('taskkill /IM yt-dlp.exe /F /T', { stdio: 'ignore', windowsHide: true });
  } catch {}

  // Record emergency stop incident
  recordIncident({
    type: 'EMERGENCY_STOP',
    title: 'Manual Emergency Stop Triggered',
    message: `All background encoding and downloading processes were terminated by the user.`,
    severity: 'INFO',
    suggestion: 'Background tasks cleared. System idle and safe.'
  });

  return { success: true, count: killed.length, killed };
}

// 3. Incidents & Failures Store
async function loadIncidents() {
  if (incidentsCache) return incidentsCache;
  try {
    if (fs.existsSync(INCIDENTS_FILE)) {
      const data = JSON.parse(await fsp.readFile(INCIDENTS_FILE, 'utf8'));
      incidentsCache = Array.isArray(data) ? data : [];
    } else {
      incidentsCache = [];
    }
  } catch {
    incidentsCache = [];
  }
  return incidentsCache;
}

async function saveIncidents(list) {
  try {
    await fsp.mkdir(path.dirname(INCIDENTS_FILE), { recursive: true });
    await fsp.writeFile(INCIDENTS_FILE, JSON.stringify(list.slice(0, MAX_INCIDENTS), null, 2), 'utf8');
    incidentsCache = list;
  } catch (err) {
    console.error('Failed to save incidents:', err.message);
  }
}

async function recordIncident({
  type = 'GENERAL_ERROR',
  title = 'System Warning',
  message = '',
  details = null,
  severity = 'WARNING', // 'INFO' | 'WARNING' | 'CRITICAL'
  jobId = null,
  clipId = null,
  suggestion = null
}) {
  const incidents = await loadIncidents();
  const id = `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item = {
    id,
    type,
    title,
    message: String(message || '').slice(0, 800),
    details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)).slice(0, 2000) : null,
    severity,
    jobId,
    clipId,
    suggestion: suggestion || generateSuggestion(type, message),
    timestamp: new Date().toISOString(),
    time: Date.now()
  };

  incidents.unshift(item);
  if (incidents.length > MAX_INCIDENTS) incidents.pop();
  await saveIncidents(incidents);
  return item;
}

function generateSuggestion(type, message) {
  const msg = (message || '').toLowerCase();
  if (type === 'OUT_OF_MEMORY' || msg.includes('memory') || msg.includes('oom')) {
    return 'Your laptop has ~800 MB free RAM. Keep batch renders to 5 clips at a time (use Safe 5 button) and close unnecessary browser tabs.';
  }
  if (type === 'FFMPEG_CRASH' || msg.includes('ffmpeg') || msg.includes('exit code')) {
    return 'Check if the source slice is intact. FFmpeg thread limit of 2 is active to prevent CPU overheating.';
  }
  if (type === 'DOWNLOAD_FAILURE' || msg.includes('yt-dlp') || msg.includes('403') || msg.includes('throttled')) {
    return 'YouTube may be throttling high-rate slice downloads. Wait 1 minute or reconnect via URL.';
  }
  if (type === 'TRANSCRIPTION_ERROR' || msg.includes('whisper')) {
    return 'Faster-whisper ran into an issue. Local fallback heuristics are available.';
  }
  return 'Review the detailed failure logs below or run Emergency Stop if the process is unresponsive.';
}

async function clearIncidents() {
  incidentsCache = [];
  try {
    if (fs.existsSync(INCIDENTS_FILE)) {
      await fsp.unlink(INCIDENTS_FILE);
    }
  } catch {}
  return { success: true };
}

// 4. Cleanup Temporary Files
async function cleanupTempFiles() {
  const cleaned = [];
  try {
    // Check finished directory for orphaned slices
    if (fs.existsSync(FINISHED)) {
      const jobDirs = await fsp.readdir(FINISHED, { withFileTypes: true });
      for (const d of jobDirs) {
        if (d.isDirectory()) {
          const subDirPath = path.join(FINISHED, d.name);
          const files = await fsp.readdir(subDirPath);
          for (const f of files) {
            if (f.startsWith('_hd_slice_') || f.startsWith('_raw_') || f.endsWith('.part') || f.startsWith('_teaser_') || f.startsWith('_concat_')) {
              try {
                const target = path.join(subDirPath, f);
                const stat = await fsp.stat(target);
                await fsp.unlink(target);
                cleaned.push({ file: f, sizeMb: Math.round(stat.size / 1024 / 1024 * 10) / 10 });
              } catch {}
            }
          }
        }
      }
    }

    // Trigger Node garbage collection if exposed
    if (global.gc) {
      try { global.gc(); } catch {}
    }
  } catch (err) {
    console.warn('Cleanup error:', err.message);
  }
  return { success: true, count: cleaned.length, cleaned };
}

// 5. Complete Hardware Telemetry
function getHardwareTelemetry() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsedPercent = Math.round((usedMem / totalMem) * 100);
  const freeMemMb = Math.round(freeMem / 1024 / 1024);
  const totalMemGb = (totalMem / 1024 / 1024 / 1024).toFixed(1);
  const usedMemGb = (usedMem / 1024 / 1024 / 1024).toFixed(1);

  // System Health Status
  let healthStatus = 'HEALTHY';
  let healthMessage = 'System resources within safe operating thresholds.';
  let healthColor = '#22c55e'; // Green

  if (freeMemMb < 500) {
    healthStatus = 'CRITICAL_OOM_RISK';
    healthMessage = `Critical: Only ${freeMemMb} MB RAM remaining! Windows crash/freeze imminent if high load begins.`;
    healthColor = '#ef4444'; // Red
  } else if (freeMemMb < 1000 || memUsedPercent > 88) {
    healthStatus = 'HIGH_LOAD';
    healthMessage = `Warning: High memory pressure (${memUsedPercent}% used, ${freeMemMb} MB free). Laptop Safe Mode recommended.`;
    healthColor = '#f59e0b'; // Amber
  }

  // CPU Info
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Intel(R) Core(TM) i7-10610U';
  const logicalCores = cpus.length;

  // Calculate CPU load average across cores
  let idleSum = 0;
  let totalSum = 0;
  for (const core of cpus) {
    const times = core.times;
    idleSum += times.idle;
    totalSum += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  const cpuUsagePercent = totalSum > 0 ? Math.min(100, Math.max(0, Math.round((1 - idleSum / totalSum) * 100))) : 0;

  // Process Memory (AutoClip server)
  const nodeMem = process.memoryUsage();

  // Disk space check on DATA drive
  let diskFreeMb = null;
  try {
    const driveLetter = path.resolve(DATA).slice(0, 2).replace(':', '');
    const diskOut = execSync(`powershell -NoProfile -Command "(Get-PSDrive '${driveLetter}').Free / 1MB"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    }).trim();
    if (diskOut) diskFreeMb = Math.round(Number(diskOut));
  } catch {}

  const diskFreeGb = diskFreeMb ? (diskFreeMb / 1024).toFixed(1) : 'Unknown';

  return {
    health: {
      status: healthStatus,
      message: healthMessage,
      color: healthColor,
      isSafeModeActive: true,
      ffmpegThreadCap: 2
    },
    memory: {
      totalGb: totalMemGb,
      usedGb: usedMemGb,
      freeMb: freeMemMb,
      usedPercent: memUsedPercent,
      nodeRssMb: Math.round(nodeMem.rss / 1024 / 1024),
      nodeHeapUsedMb: Math.round(nodeMem.heapUsed / 1024 / 1024)
    },
    cpu: {
      model: cpuModel,
      logicalCores,
      threadsPerEncode: 2,
      usagePercent: cpuUsagePercent,
      uptimeSec: Math.round(os.uptime()),
      uptimeStr: formatDuration(os.uptime())
    },
    disk: {
      drive: path.resolve(DATA).slice(0, 3),
      freeMb: diskFreeMb,
      freeGb: diskFreeGb,
      status: diskFreeMb && diskFreeMb < 3000 ? 'LOW' : 'OK'
    },
    server: {
      uptimeSec: Math.round(process.uptime()),
      uptimeStr: formatDuration(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version
    }
  };
}

module.exports = {
  initLogger,
  recentLogs,
  registerProcess,
  unregisterProcess,
  getActiveProcesses,
  killProcess,
  emergencyStop,
  recordIncident,
  loadIncidents,
  clearIncidents,
  cleanupTempFiles,
  getHardwareTelemetry,
  formatDuration
};

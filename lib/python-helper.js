const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { ROOT, DATA } = require('./config');

let cachedPython = null;

/**
 * Intelligent Cross-Platform Python Command Resolver
 * Automatically detects python3 vs python across Windows, macOS, and Linux
 */
function getPythonCommand() {
  if (cachedPython) return cachedPython;
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    cachedPython = process.env.PYTHON_PATH;
    return cachedPython;
  }

  // Check bundled standalone Python directory first
  const bundledCandidates = [
    path.join(ROOT, 'python', 'python.exe'),
    path.join(path.dirname(process.execPath), 'python', 'python.exe'),
    path.join(process.resourcesPath || '', 'python', 'python.exe'),
    path.join(ROOT, '..', 'python', 'python.exe')
  ];
  for (const p of bundledCandidates) {
    if (fs.existsSync(p)) {
      cachedPython = p;
      return p;
    }
  }

  // On macOS and Linux, python3 is standard; on Windows, check python first
  const candidates = process.platform === 'win32'
    ? ['python', 'python3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore', windowsHide: true });
      cachedPython = cmd;
      return cmd;
    } catch {}
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * ASAR-Safe Python Script Path Resolver
 * Ensures external binaries (like python.exe) can access scripts even when
 * packaged inside Electron's virtual app.asar archive.
 */
function getScriptPath(scriptName) {
  const normalPath = path.join(ROOT, 'scripts', scriptName);

  // 1. If running in packaged Electron, check if electron-builder unpacked it
  if (normalPath.includes('app.asar')) {
    const unpackedPath = normalPath.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) {
      return unpackedPath;
    }
  }

  // 2. If running unpacked or in development, return normal path if present
  if (!normalPath.includes('app.asar') && fs.existsSync(normalPath)) {
    return normalPath;
  }

  // 3. Fallback: If inside app.asar and external python cannot read inside asar,
  // Node.js CAN read from app.asar! Extract it to the writable DATA/scripts directory.
  try {
    const targetDir = path.join(DATA, 'scripts');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const extractedFile = path.join(targetDir, scriptName);
    const content = fs.readFileSync(normalPath);
    if (!fs.existsSync(extractedFile) || fs.statSync(extractedFile).size !== content.length) {
      fs.writeFileSync(extractedFile, content);
    }
    return extractedFile;
  } catch (err) {
    console.warn(`[getScriptPath] Failed to extract script "${scriptName}" from asar: ${err.message}`);
    return normalPath;
  }
}

module.exports = {
  getPythonCommand,
  getScriptPath
};

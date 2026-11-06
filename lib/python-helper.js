const { execSync } = require('node:child_process');

let cachedPython = null;

/**
 * Intelligent Cross-Platform Python Command Resolver
 * Automatically detects python3 vs python across Windows, macOS, and Linux
 */
function getPythonCommand() {
  if (cachedPython) return cachedPython;
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;

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

module.exports = {
  getPythonCommand
};

const fs = require('node:fs');
const path = require('node:path');

const filename = 'AUTOCLIPIN-Windows-v1.0.1.zip';
const appPackage = path.resolve(__dirname, '..', 'dist', filename);
const stagedPackage = path.join(__dirname, 'downloads', filename);

function stageDownload(directory) {
  const source = fs.existsSync(appPackage) ? appPackage : stagedPackage;
  if (!fs.existsSync(source)) throw new Error(`App download is missing: ${appPackage}. Supply the Windows ZIP before building the website.`);
  const target = path.resolve(directory, filename);
  const sourceInfo = fs.statSync(source);
  if (!sourceInfo.isFile() || sourceInfo.size < 22) throw new Error('The app download must be a valid ZIP file.');
  fs.mkdirSync(path.dirname(target), {recursive:true});
  if (fs.existsSync(target)) {
    const targetInfo = fs.statSync(target);
    if (sourceInfo.dev === targetInfo.dev && sourceInfo.ino === targetInfo.ino) return target;
    // Replace only the explicitly named distribution file, never a directory.
    fs.unlinkSync(target);
  }
  try { fs.linkSync(source, target); }
  catch { fs.copyFileSync(source, target); }
  return target;
}

module.exports = {stageDownload, filename};

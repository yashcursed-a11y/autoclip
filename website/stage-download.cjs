const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const filename = 'AUTOCLIPIN-Windows-v1.0.1.zip';
const appPackage = path.resolve(__dirname, '..', 'dist', filename);
const stagedPackage = path.resolve(__dirname, '..', 'public', 'downloads', filename);

function checksum(file) {
  const hash=crypto.createHash('sha256');
  const buffer=Buffer.allocUnsafe(512*1024),fd=fs.openSync(file,'r');
  try { let count; while((count=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,count)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

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
    if(targetInfo.size===sourceInfo.size && checksum(source)===checksum(target))return target;
    fs.copyFileSync(source,target);
    return target;
  }
  try { fs.linkSync(source, target); }
  catch { fs.copyFileSync(source, target); }
  return target;
}

module.exports = {stageDownload, filename};

const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.argv[2];
if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN required');
  process.exit(1);
}

const OWNER = 'yashcursed-a11y';
const REPO = 'autoclip';
const RELEASE_ID = 441010774;
const FILE_PATH = 'D:\\AutoClip_Bundle\\AUTOCLIPIN-v2.1.0-Ultimate-Creator-Bundle-Windows.zip';
const ASSET_NAME = 'AUTOCLIPIN-v2.1.0-Ultimate-Creator-Bundle-Windows.zip';

async function main() {
  if (!fs.existsSync(FILE_PATH)) {
    console.error('File does not exist:', FILE_PATH);
    process.exit(1);
  }

  const stat = fs.statSync(FILE_PATH);
  console.log(`[UploadGiant] Preparing to upload ${ASSET_NAME} (${(stat.size / (1024*1024)).toFixed(1)} MB)...`);

  // 1. List assets to remove old version if present
  console.log('[UploadGiant] Checking existing release assets...');
  const assets = await new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/releases/${RELEASE_ID}/assets`,
      headers: {
        'User-Agent': 'NodeJS',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });

  const existing = assets.find(a => a.name === ASSET_NAME);
  if (existing) {
    console.log(`[UploadGiant] Found existing asset ID ${existing.id}, deleting first...`);
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.github.com',
        path: `/repos/${OWNER}/${REPO}/releases/assets/${existing.id}`,
        method: 'DELETE',
        headers: {
          'User-Agent': 'NodeJS',
          'Authorization': `Bearer ${GITHUB_TOKEN}`
        }
      }, res => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.end();
    });
    console.log('[UploadGiant] Old asset removed.');
  }

  // 2. Upload asset stream
  console.log('[UploadGiant] Streaming giant asset to GitHub Release...');
  const uploadUrl = `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${RELEASE_ID}/assets?name=${encodeURIComponent(ASSET_NAME)}`;
  const urlObj = new URL(uploadUrl);

  const fileStream = fs.createReadStream(FILE_PATH);

  const uploadReq = https.request({
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'User-Agent': 'NodeJS',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/zip',
      'Content-Length': stat.size
    }
  }, res => {
    let respData = '';
    res.on('data', c => respData += c);
    res.on('end', () => {
      console.log('\n[UploadGiant] GitHub Response Status:', res.statusCode);
      if (res.statusCode === 201) {
        const created = JSON.parse(respData);
        console.log(`[UploadGiant] SUCCESS! Uploaded ${created.name} (${(created.size / (1024*1024)).toFixed(1)} MB)`);
        console.log(`[UploadGiant] Download URL: ${created.browser_download_url}`);
      } else {
        console.error('[UploadGiant] Failed with status', res.statusCode, respData);
      }
    });
  });

  uploadReq.on('error', err => {
    console.error('\n[UploadGiant] Request error:', err);
  });

  let uploadedBytes = 0;
  fileStream.on('data', chunk => {
    uploadedBytes += chunk.length;
    process.stdout.write(`\rUploading: ${((uploadedBytes / stat.size) * 100).toFixed(1)}% (${(uploadedBytes / (1024*1024)).toFixed(1)} MB)`);
  });

  fileStream.pipe(uploadReq);
}

main().catch(console.error);

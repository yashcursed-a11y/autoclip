const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_TOKEN = process.argv[2] || process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('Error: GitHub token is required.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const VERSION = pkg.version || '1.0.1';

const REPO_NAME = 'autoclip';
const TAG_NAME = `v${VERSION}`;
const RELEASE_TITLE = `AutoClip v${VERSION} - Windows Release`;
const RELEASE_BODY = `## ⚡ AutoClip Studio v${VERSION}

Upgraded UI, Advanced Adaptive Framing & Timeline Engine.

### 🌟 What's New in v${VERSION}
- **Adaptive Framing Suite**: Upgraded smart framing, blur backgrounds & dynamic crop presets.
- **Refined Studio UI**: Upgraded visual styling, glassmorphism and enhanced micro-interactions.
- **CapCut Full-Screen Editing Studio**: Live timeline scrubbing, frame cutting (\`[S]\`), trim handles, and delete (\`[Del]\`).
- **30-Day Free Pass**: 100 free clip exports per week.
- **Phone Caption Studio**: Real-time kinetic subtitles with 6 viral presets.
- **Offline Rating Engine v3**: 100% local video analysis with zero cloud dependency.

### ⬇️ Download & Install
Download **AutoClip-Setup-${VERSION}.exe** below and double-click to install on Windows.`;

const SETUP_EXE_PATH = path.join(__dirname, '..', 'dist', `AutoClip Setup ${VERSION}.exe`);
const PORTABLE_EXE_PATH = path.join(__dirname, '..', 'dist', `AutoClip ${VERSION}.exe`);

function githubRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'AutoClip-Uploader',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        ...(options.headers || {})
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(json);
        } else {
          const err = new Error(json.message || `HTTP ${res.statusCode}`);
          err.status = res.statusCode;
          err.details = json;
          reject(err);
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      if (Buffer.isBuffer(postData)) {
        req.write(postData);
      } else if (typeof postData === 'object') {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

function uploadAsset(uploadUrl, filePath, assetName) {
  return new Promise((resolve, reject) => {
    const stats = fs.statSync(filePath);
    const cleanUrl = uploadUrl.replace(/\{(\?name,label)?\}$/, '');
    const finalUrl = `${cleanUrl}?name=${encodeURIComponent(assetName)}`;
    const parsed = new URL(finalUrl);

    console.log(`[Upload] Uploading ${assetName} (${Math.round(stats.size / (1024 * 1024))} MB)...`);

    const reqOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'User-Agent': 'AutoClip-Uploader',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(json);
        } else {
          const err = new Error(json.message || `HTTP ${res.statusCode}`);
          err.status = res.statusCode;
          err.details = json;
          reject(err);
        }
      });
    });

    req.on('error', reject);

    const fileStream = fs.createReadStream(filePath);
    let uploadedBytes = 0;
    fileStream.on('data', chunk => {
      uploadedBytes += chunk.length;
      const pct = Math.round((uploadedBytes / stats.size) * 100);
      process.stdout.write(`\r[Upload] Progress: ${pct}% (${Math.round(uploadedBytes / (1024 * 1024))} MB)`);
    });

    fileStream.on('end', () => {
      console.log('\n[Upload] Stream finished, awaiting GitHub processing...');
    });

    fileStream.pipe(req);
  });
}

async function main() {
  console.log('======================================================');
  console.log('       🚀 AUTOCLIP GITHUB RELEASE PUBLISHER           ');
  console.log('======================================================\n');

  // Step 1: Authenticate and get user
  console.log('[Step 1] Verifying GitHub Token...');
  const user = await githubRequest('https://api.github.com/user');
  console.log(`✓ Authenticated as: @${user.login} (${user.name || user.login})`);

  // Step 2: Check or create repository
  console.log(`\n[Step 2] Checking repository "${user.login}/${REPO_NAME}"...`);
  let repo;
  try {
    repo = await githubRequest(`https://api.github.com/repos/${user.login}/${REPO_NAME}`);
    console.log(`✓ Repository already exists: ${repo.html_url}`);
  } catch (err) {
    if (err.status === 404) {
      console.log(`Repository does not exist yet. Creating public repository "${REPO_NAME}"...`);
      repo = await githubRequest('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        name: REPO_NAME,
        description: 'AutoClip Pro Studio - AI Video Clipping & Timeline Editing Suite',
        private: false,
        auto_init: true
      });
      console.log(`✓ Repository created: ${repo.html_url}`);
    } else {
      throw err;
    }
  }

  // Step 3: Check or create release
  console.log(`\n[Step 3] Checking release tag "${TAG_NAME}"...`);
  let release;
  try {
    release = await githubRequest(`https://api.github.com/repos/${user.login}/${REPO_NAME}/releases/tags/${TAG_NAME}`);
    console.log(`✓ Release ${TAG_NAME} already exists (ID: ${release.id})`);
  } catch (err) {
    if (err.status === 404) {
      console.log(`Creating new release "${TAG_NAME}"...`);
      release = await githubRequest(`https://api.github.com/repos/${user.login}/${REPO_NAME}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        tag_name: TAG_NAME,
        name: RELEASE_TITLE,
        body: RELEASE_BODY,
        draft: false,
        prerelease: false
      });
      console.log(`✓ Release created: ${release.html_url}`);
    } else {
      throw err;
    }
  }

  // Step 4: Upload Setup Installer
  console.log(`\n[Step 4] Uploading Windows Setup Installer...`);
  if (!fs.existsSync(SETUP_EXE_PATH)) {
    throw new Error(`File not found: ${SETUP_EXE_PATH}`);
  }

  // Delete existing asset if it exists with same name
  const setupAssetName = `AutoClip-Setup-${VERSION}.exe`;
  const portableAssetName = `AutoClip-Portable-${VERSION}.exe`;

  const existingAssets = release.assets || [];
  const existingAsset = existingAssets.find(a => a.name === setupAssetName || a.name === 'AutoClip-Setup-1.0.0.exe');
  if (existingAsset) {
    console.log(`Deleting existing asset ${existingAsset.name} (ID: ${existingAsset.id})...`);
    await githubRequest(`https://api.github.com/repos/${user.login}/${REPO_NAME}/releases/assets/${existingAsset.id}`, {
      method: 'DELETE'
    });
  }

  const asset = await uploadAsset(release.upload_url, SETUP_EXE_PATH, setupAssetName);
  console.log(`✓ Setup Installer uploaded successfully!`);

  // Step 5: Upload Portable edition if available
  if (fs.existsSync(PORTABLE_EXE_PATH)) {
    console.log(`\n[Step 5] Uploading Portable Executable...`);
    const existingPortable = existingAssets.find(a => a.name === portableAssetName || a.name === 'AutoClip-Portable-1.0.0.exe');
    if (existingPortable) {
      await githubRequest(`https://api.github.com/repos/${user.login}/${REPO_NAME}/releases/assets/${existingPortable.id}`, {
        method: 'DELETE'
      });
    }
    await uploadAsset(release.upload_url, PORTABLE_EXE_PATH, portableAssetName);
    console.log(`✓ Portable Executable uploaded successfully!`);
  }

  console.log('\n======================================================');
  console.log('       🎉 RELEASE PUBLISHED SUCCESSFULLY!             ');
  console.log('======================================================\n');
  console.log(`  Release Page:       ${release.html_url}`);
  console.log(`  Direct Download:    ${asset.browser_download_url}\n`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('\n❌ Release Publication Failed:', err.message);
  if (err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});

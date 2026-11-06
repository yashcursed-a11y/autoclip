const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { google } = require('googleapis');
const { OAUTH_FILE, TOKEN_FILE, TOKENS_DIR } = require('./config');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function getOAuthClient(redirectUri = 'http://localhost:4173/api/drive/callback', accountId = null) {
  if (!fs.existsSync(OAUTH_FILE)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(OAUTH_FILE, 'utf8'));
    const cfg = raw.installed || raw.web || raw;
    const client = new google.auth.OAuth2(
      cfg.client_id,
      cfg.client_secret,
      redirectUri
    );

    let tokenPath = TOKEN_FILE;
    if (accountId && accountId !== 'default') {
      const specific = path.join(TOKENS_DIR, `${accountId}.json`);
      if (fs.existsSync(specific)) {
        tokenPath = specific;
      }
    }

    if (fs.existsSync(tokenPath)) {
      client.setCredentials(JSON.parse(fs.readFileSync(tokenPath, 'utf8')));
    }

    client.on('tokens', tokens => {
      const prev = fs.existsSync(tokenPath) ? JSON.parse(fs.readFileSync(tokenPath, 'utf8')) : {};
      fs.writeFileSync(tokenPath, JSON.stringify({ ...prev, ...tokens }, null, 2), 'utf8');
    });

    return client;
  } catch (err) {
    console.error('Failed to initialize OAuth client:', err.message);
    return null;
  }
}

function getAuthUrl(redirectUri) {
  const client = getOAuthClient(redirectUri);
  if (!client) throw new Error('config/google-oauth.json is missing or invalid.');
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

function getYouTubeAuthUrl(redirectUri, accountId = null) {
  const client = getOAuthClient(redirectUri, accountId);
  if (!client) throw new Error('config/google-oauth.json is missing or invalid.');
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: YOUTUBE_SCOPES,
    state: accountId || 'default'
  });
}

async function handleCallback(code, redirectUri, accountId = null) {
  const client = getOAuthClient(redirectUri, accountId);
  if (!client) throw new Error('config/google-oauth.json missing.');
  const { tokens } = await client.getToken(code);

  if (accountId && accountId !== 'default') {
    if (!fs.existsSync(TOKENS_DIR)) fs.mkdirSync(TOKENS_DIR, { recursive: true });
    await fsp.writeFile(path.join(TOKENS_DIR, `${accountId}.json`), JSON.stringify(tokens, null, 2), 'utf8');
  }
  await fsp.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');

  // Automatically fetch channel name, handle, and avatar photo for this connected YouTube account
  client.setCredentials(tokens);
  try {
    const youtube = google.youtube({ version: 'v3', auth: client });
    const res = await youtube.channels.list({ part: ['snippet'], mine: true });
    const channel = res.data?.items?.[0];
    if (channel && accountId && accountId !== 'default') {
      const { updateAccount } = require('./db');
      const snippet = channel.snippet || {};
      const avatarUrl = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
      const customHandle = snippet.customUrl ? (snippet.customUrl.startsWith('@') ? snippet.customUrl : `@${snippet.customUrl}`) : `@${(snippet.title || '').replace(/\s+/g, '')}`;
      await updateAccount(accountId, {
        name: snippet.title || 'YouTube Channel',
        handle: customHandle,
        avatarUrl: avatarUrl || undefined,
        channelId: channel.id
      });
      console.log(`[YouTube Link] Successfully updated account "${snippet.title}" with live avatar photo!`);
    }
  } catch (ytErr) {
    console.warn('[YouTube Auto-Fetch] Note:', ytErr.message);
  }

  return tokens;
}

// Ensure the standard folder structure:
// AUTOCLIP/
//   ├── Incoming/
//   ├── Processing/
//   ├── Finished Clips/
//   └── Failed/
async function getOrCreateFolder(drive, name, parentId = null) {
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += ` and 'root' in parents`;
  }

  const listRes = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  if (listRes.data.files && listRes.data.files.length > 0) {
    return listRes.data.files[0].id;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    },
    fields: 'id, name'
  });

  return createRes.data.id;
}

async function getAutoclipFolders(drive) {
  const rootId = await getOrCreateFolder(drive, 'AUTOCLIP');
  const incomingId = await getOrCreateFolder(drive, 'Incoming', rootId);
  const processingId = await getOrCreateFolder(drive, 'Processing', rootId);
  const finishedId = await getOrCreateFolder(drive, 'Finished Clips', rootId);
  const failedId = await getOrCreateFolder(drive, 'Failed', rootId);

  return { rootId, incomingId, processingId, finishedId, failedId };
}

// Upload a file to Drive
async function uploadFileToDrive(filePath, fileName, parentFolderId) {
  const client = getOAuthClient();
  if (!client || !client.credentials || !client.credentials.access_token) {
    return null;
  }

  const drive = google.drive({ version: 'v3', auth: client });
  const fileMetadata = {
    name: fileName,
    parents: parentFolderId ? [parentFolderId] : undefined
  };
  const media = {
    body: fs.createReadStream(filePath)
  };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink, webContentLink, parents'
  });

  return res.data;
}

// Move file to Trash (Safe deletion: NEVER permanently deletes files automatically)
async function moveFileToTrash(fileId) {
  if (!fileId) return false;
  const client = getOAuthClient();
  if (!client) return false;

  const drive = google.drive({ version: 'v3', auth: client });
  const res = await drive.files.update({
    fileId,
    requestBody: {
      trashed: true
    },
    fields: 'id, name, trashed'
  });

  return Boolean(res.data.trashed);
}

// Move file from one folder to another (e.g. Incoming -> Processing or Failed)
async function moveFileFolder(fileId, removeParentId, addParentId) {
  if (!fileId) return null;
  const client = getOAuthClient();
  if (!client) return null;

  const drive = google.drive({ version: 'v3', auth: client });
  const res = await drive.files.update({
    fileId,
    addParents: addParentId,
    removeParents: removeParentId,
    fields: 'id, name, parents'
  });

  return res.data;
}

module.exports = {
  getOAuthClient,
  getAuthUrl,
  getYouTubeAuthUrl,
  handleCallback,
  getAutoclipFolders,
  uploadFileToDrive,
  moveFileToTrash,
  moveFileFolder
};

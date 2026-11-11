const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');

// Prepend bundled binaries to PATH so child processes inherit FFmpeg, FFprobe, and yt-dlp
const potentialBinDirs = [
  path.join(__dirname, 'bin'),
  path.join(path.dirname(process.execPath), 'bin'),
  path.join(process.resourcesPath || '', 'bin')
];
for (const dir of potentialBinDirs) {
  if (fs.existsSync(dir) && !process.env.PATH.includes(dir)) {
    process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
  }
}

const potentialPyDirs = [
  path.join(__dirname, 'python'),
  path.join(path.dirname(process.execPath), 'python'),
  path.join(process.resourcesPath || '', 'python')
];
for (const pydir of potentialPyDirs) {
  if (fs.existsSync(pydir) && !process.env.PATH.includes(pydir)) {
    process.env.PATH = `${pydir}${path.delimiter}${path.join(pydir, 'Scripts')}${path.delimiter}${process.env.PATH}`;
  }
}

let mainWindow = null;
const PORT = process.env.PORT || 4173;
const APP_ZOOM_STEPS = [.6,.67,.75,.8,.9,1,1.1,1.25,1.5];
let appZoom = 1, zoomConfigured = false;
function persistAppZoom(factor) {
  if (!Number.isFinite(factor)) return { factor:appZoom, configured:zoomConfigured };
  appZoom = Math.max(.6, Math.min(1.5, factor));zoomConfigured = true;
  mainWindow?.webContents.setZoomFactor(appZoom);
  try { fs.writeFileSync(path.join(app.getPath('userData'),'interface-zoom.json'), JSON.stringify({factor:appZoom})); } catch (error) { console.warn('Could not persist interface zoom:',error.message); }
  mainWindow?.webContents.send('autoclip:zoom-changed',{factor:appZoom,configured:true});
  return { factor:appZoom, configured:true };
}
function authorizedZoomSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) return false;
  try { const url = new URL(event.senderFrame?.url || event.sender.getURL());return url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname) && url.port===String(PORT); } catch { return false; }
}
ipcMain.handle('autoclip:get-zoom',event=>{if(!authorizedZoomSender(event))throw new Error('Unavailable outside the local studio');return {factor:appZoom,configured:zoomConfigured};});
ipcMain.handle('autoclip:set-zoom',(event,factor)=>{if(!authorizedZoomSender(event))throw new Error('Unavailable outside the local studio');return persistAppZoom(factor);});

/**
 * Check if the AutoClip backend server is already running
 */
function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/system/status`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Start the internal Express server if not already up
 */
async function ensureServerRunning() {
  const running = await isServerRunning(PORT);
  if (!running) {
    console.log('[Electron] Starting internal AUTOCLIPIN backend server...');
    try {
      require('./server.js');
      // Wait for server to be responsive
      let retries = 20;
      while (retries > 0) {
        await new Promise(r => setTimeout(r, 200));
        if (await isServerRunning(PORT)) break;
        retries--;
      }
    } catch (err) {
      console.error('[Electron] Failed to start server:', err);
    }
  } else {
    console.log(`[Electron] AUTOCLIPIN server already active on port ${PORT}`);
  }
}

/**
 * Create the main desktop application window
 */
function createWindow() {
  try { const saved=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'interface-zoom.json'),'utf8'));if(Number.isFinite(saved.factor)){appZoom=Math.max(.6,Math.min(1.5,saved.factor));zoomConfigured=true;} } catch {}
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'AUTOCLIPIN Pro Studio',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#0a0c10',
    show: false, // Don't show until ready-to-show for smooth appearance
    webPreferences: {
      preload: path.join(__dirname,'electron-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // Load the local CapCut Studio app
  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.webContents.on('did-finish-load',()=>{mainWindow?.webContents.setZoomFactor(appZoom);mainWindow?.webContents.send('autoclip:zoom-changed',{factor:appZoom,configured:zoomConfigured});});
  mainWindow.webContents.on('before-input-event',(event,input)=>{
    if(input.type!=='keyDown'||(!input.control&&!input.meta)||input.alt)return;
    if(['+','=','Add'].includes(input.key)){event.preventDefault();persistAppZoom(APP_ZOOM_STEPS.find(value=>value>appZoom+.001)??1.5);}
    else if(['-','_','Subtract'].includes(input.key)){event.preventDefault();persistAppZoom([...APP_ZOOM_STEPS].reverse().find(value=>value<appZoom-.001)??.6);}
    else if(input.key==='0'){event.preventDefault();persistAppZoom(1);}
  });

  // Show window smoothly when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Intercept external links (OAuth, YouTube, Google Drive) to open in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://accounts.google.com') || 
        url.startsWith('https://youtu') || 
        url.startsWith('https://www.youtube.com') ||
        url.startsWith('http://localhost') === false) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Keep Windows/Linux chrome clean; Alt should not restore the legacy menu.
  if (process.platform === 'darwin') {
    setupAppMenu();
  } else {
    Menu.setApplicationMenu(null);
    mainWindow.removeMenu();
  }
}

/**
 * Setup clean application menu bar
 */
function setupAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data Directory',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const dataDir = process.env.AUTOCLIP_DATA_DIR || 'D:\\AutoClip_Data';
            shell.openPath(dataDir);
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Creator Pass',
      submenu: [
        {
          label: 'Enter License Key / Quota Info',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if (typeof openLicenseModal === "function") openLicenseModal();');
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'How to Connect YouTube & Drive',
          accelerator: 'F1',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if (typeof showConnectionHelpModal === "function") showConnectionHelpModal();');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => {
            triggerManualUpdateCheck();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

let isManualCheck = false;

function triggerManualUpdateCheck() {
  const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE);

  if (isPortable) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'AUTOCLIPIN Portable Edition',
      message: `You are running the Portable (zero-install) edition of AUTOCLIPIN v${app.getVersion()}.\n\nPortable builds do not support in-place patching. Would you like to check for the latest release on GitHub?`,
      buttons: ['Download from GitHub', 'Close']
    }).then(res => {
      if (res.response === 0) {
        shell.openExternal('https://github.com/yashcursed-a11y/autoclip/releases');
      }
    });
    return;
  }

  if (!app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'AUTOCLIPIN Development',
      message: `Running in local development mode (v${app.getVersion()}). Auto-updates are active in packaged .exe builds.`
    });
    return;
  }

  isManualCheck = true;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'AUTOCLIPIN Updater',
    message: 'Checking GitHub for new updates...'
  });

  autoUpdater.checkForUpdates().catch(err => {
    isManualCheck = false;
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Update Check Notice',
      message: `Could not reach GitHub updater: ${err.message}\n\nYou can always download the latest release directly from GitHub.`,
      buttons: ['Open GitHub Releases', 'Dismiss']
    }).then(res => {
      if (res.response === 0) {
        shell.openExternal('https://github.com/yashcursed-a11y/autoclip/releases');
      }
    });
  });
}

/**
 * Configure automatic background updates with user notifications
 */
function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates on GitHub...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Found update:', info.version);
    isManualCheck = false;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Found',
      message: `A new version of AUTOCLIPIN (v${info.version}) is available!\n\nDownloading the update in the background now...`,
      buttons: ['OK']
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] App is up to date:', info.version);
    if (isManualCheck) {
      isManualCheck = false;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'AUTOCLIPIN is Up to Date',
        message: `You are already using the newest version of AUTOCLIPIN (v${app.getVersion()})!`
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] Error:', err.message);
    if (isManualCheck) {
      isManualCheck = false;
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Update Check',
        message: `Could not verify update: ${err.message}`,
        buttons: ['Visit GitHub Releases', 'OK']
      }).then(res => {
        if (res.response === 0) {
          shell.openExternal('https://github.com/yashcursed-a11y/autoclip/releases');
        }
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'AUTOCLIPIN Update Ready',
      message: `AUTOCLIPIN v${info.version} has finished downloading.\n\nRestart now to apply the update?`,
      buttons: ['Restart and Install', 'Later']
    }).then((btn) => {
      if (btn.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Check on launch after 5 seconds (only for installed app)
  const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE);
  if (!isPortable) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 5000);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  await ensureServerRunning();
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

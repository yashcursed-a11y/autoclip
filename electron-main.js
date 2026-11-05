const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');

let mainWindow = null;
const PORT = process.env.PORT || 4173;

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
    console.log('[Electron] Starting internal AutoClip backend server...');
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
    console.log(`[Electron] AutoClip server already active on port ${PORT}`);
  }
}

/**
 * Create the main desktop application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'AutoClip Pro Studio',
    backgroundColor: '#0a0c10',
    show: false, // Don't show until ready-to-show for smooth appearance
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // Load the local CapCut Studio app
  mainWindow.loadURL(`http://localhost:${PORT}`);

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

  setupAppMenu();
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
          label: 'Check for Updates',
          click: () => {
            if (app.isPackaged) {
              autoUpdater.checkForUpdatesAndNotify();
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'AutoClip Updater',
                message: 'Auto-update is active for packaged desktop builds (.exe).'
              });
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Configure silent automatic background updates
 */
function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Found update:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'AutoClip Update Ready',
      message: `AutoClip v${info.version} has been downloaded. Restart to update now?`,
      buttons: ['Restart and Install', 'Later']
    }).then((btn) => {
      if (btn.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Check on launch after 4 seconds
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 4000);
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

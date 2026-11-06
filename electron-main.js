const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');

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
  try { const saved=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'interface-zoom.json'),'utf8'));if(Number.isFinite(saved.factor)){appZoom=Math.max(.6,Math.min(1.5,saved.factor));zoomConfigured=true;} } catch {}
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'AutoClip Pro Studio',
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

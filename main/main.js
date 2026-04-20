const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const cryptoService = require('./services/crypto-service');
const connectionStore = require('./services/connection-store');
const { registerSSHHandlers } = require('./ipc/ssh-handlers');
const { registerSFTPHandlers } = require('./ipc/sftp-handlers');
const { registerConnectionHandlers } = require('./ipc/connection-handlers');

let mainWindow = null;

/**
 * Resolves the portable data directory path.
 * Production (USB mode): "data" folder next to the exe.
 * Development: "data" folder inside Electron's userData directory.
 */
function getDataPath() {
  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), 'data');
  }
  return path.join(app.getPath('userData'), 'data');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load from Vite dev server or built files
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize portable data directory
  const dataPath = getDataPath();
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  // Initialize services with portable data path
  cryptoService.init(dataPath);
  connectionStore.init(dataPath);

  createWindow();

  // Register all IPC handlers
  registerSSHHandlers(ipcMain);
  registerSFTPHandlers(ipcMain);
  registerConnectionHandlers(ipcMain);

  // Window control handlers
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clean up all SSH connections on quit
  const { disconnectAll } = require('./services/ssh-service');
  disconnectAll();
  if (process.platform !== 'darwin') app.quit();
});

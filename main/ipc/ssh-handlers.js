const sshService = require('../services/ssh-service');
const connectionStore = require('../services/connection-store');
const { BrowserWindow } = require('electron');

/**
 * Registers IPC handlers for SSH connection, shell, and exec operations.
 */
function registerSSHHandlers(ipcMain) {
  // Connect using a stored connection's credentials
  ipcMain.handle('ssh:connect', async (_event, config) => {
    try {
      let connectionConfig = config;

      // If connecting via stored connection ID, fetch decrypted credentials
      if (config.connectionId) {
        const stored = connectionStore.getWithCredentials(config.connectionId);
        if (!stored) return { success: false, error: 'Connection not found' };
        connectionConfig = stored;
      }

      const sessionId = await sshService.connect(connectionConfig);
      return { success: true, sessionId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ssh:disconnect', async (_event, sessionId) => {
    try {
      sshService.disconnect(sessionId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ssh:exec', async (_event, sessionId, command) => {
    try {
      const result = await sshService.exec(sessionId, command);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Interactive shell management
  ipcMain.handle('ssh:shell:open', async (event, sessionId, termId, cols, rows) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      await sshService.openShell(sessionId, termId, cols, rows, win.webContents);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ssh:shell:write', async (_event, termId, data) => {
    try {
      sshService.writeShell(termId, data);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ssh:shell:resize', async (_event, termId, cols, rows) => {
    try {
      sshService.resizeShell(termId, cols, rows);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ssh:shell:close', async (_event, termId) => {
    try {
      sshService.closeShell(termId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerSSHHandlers };

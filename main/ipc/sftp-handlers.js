const sftpService = require('../services/sftp-service');
const { dialog } = require('electron');
const fs = require('fs');

/**
 * Registers IPC handlers for SFTP file operations.
 */
function registerSFTPHandlers(ipcMain) {
  ipcMain.handle('sftp:list', async (_event, sessionId, remotePath) => {
    try {
      const entries = await sftpService.listDirectory(sessionId, remotePath);
      return { success: true, data: entries };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:readFile', async (_event, sessionId, remotePath) => {
    try {
      const content = await sftpService.readFile(sessionId, remotePath);
      return { success: true, data: content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:writeFile', async (_event, sessionId, remotePath, content) => {
    try {
      await sftpService.writeFile(sessionId, remotePath, content);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:rename', async (_event, sessionId, oldPath, newPath) => {
    try {
      await sftpService.rename(sessionId, oldPath, newPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:delete', async (_event, sessionId, remotePath) => {
    try {
      await sftpService.deleteFile(sessionId, remotePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:deleteDir', async (_event, sessionId, remotePath) => {
    try {
      await sftpService.deleteDir(sessionId, remotePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:mkdir', async (_event, sessionId, remotePath) => {
    try {
      await sftpService.mkdir(sessionId, remotePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sftp:stat', async (_event, sessionId, remotePath) => {
    try {
      const stats = await sftpService.stat(sessionId, remotePath);
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Download: save to user-chosen local path
  ipcMain.handle('sftp:download', async (event, sessionId, remotePath) => {
    try {
      const { data, filename } = await sftpService.downloadFile(sessionId, remotePath);
      const { BrowserWindow } = require('electron');
      const win = BrowserWindow.fromWebContents(event.sender);

      const result = await dialog.showSaveDialog(win, {
        defaultPath: filename,
        title: 'Save File',
      });

      if (result.canceled) return { success: false, error: 'Cancelled' };

      fs.writeFileSync(result.filePath, Buffer.from(data, 'base64'));
      return { success: true, path: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Upload: read local file and write to remote
  ipcMain.handle('sftp:upload', async (event, sessionId, remotePath) => {
    try {
      const { BrowserWindow } = require('electron');
      const win = BrowserWindow.fromWebContents(event.sender);

      const result = await dialog.showOpenDialog(win, {
        title: 'Upload File',
        properties: ['openFile'],
      });

      if (result.canceled) return { success: false, error: 'Cancelled' };

      const localPath = result.filePaths[0];
      const content = fs.readFileSync(localPath, 'utf8');
      const filename = require('path').basename(localPath);
      const targetPath = remotePath.endsWith('/') ? `${remotePath}${filename}` : `${remotePath}/${filename}`;

      await sftpService.writeFile(sessionId, targetPath, content, false);
      return { success: true, path: targetPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerSFTPHandlers };

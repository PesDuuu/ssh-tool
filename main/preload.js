const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process via context bridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Master password management
  masterGetStatus: () => ipcRenderer.invoke('master:status'),
  masterSetup: (password) => ipcRenderer.invoke('master:setup', password),
  masterUnlock: (password) => ipcRenderer.invoke('master:unlock', password),
  masterChangePassword: (oldPassword, newPassword) =>
    ipcRenderer.invoke('master:changePassword', oldPassword, newPassword),

  // Connection management (stored connections)
  getConnections: () => ipcRenderer.invoke('connections:getAll'),
  saveConnection: (conn) => ipcRenderer.invoke('connections:save', conn),
  deleteConnection: (id) => ipcRenderer.invoke('connections:delete', id),

  // SSH session management
  sshConnect: (config) => ipcRenderer.invoke('ssh:connect', config),
  sshDisconnect: (sessionId) => ipcRenderer.invoke('ssh:disconnect', sessionId),
  sshExec: (sessionId, command) => ipcRenderer.invoke('ssh:exec', sessionId, command),

  // SSH shell (interactive terminal)
  sshShellOpen: (sessionId, termId, cols, rows) =>
    ipcRenderer.invoke('ssh:shell:open', sessionId, termId, cols, rows),
  sshShellWrite: (termId, data) =>
    ipcRenderer.invoke('ssh:shell:write', termId, data),
  sshShellResize: (termId, cols, rows) =>
    ipcRenderer.invoke('ssh:shell:resize', termId, cols, rows),
  sshShellClose: (termId) =>
    ipcRenderer.invoke('ssh:shell:close', termId),
  onShellData: (callback) => {
    const handler = (_event, termId, data) => callback(termId, data);
    ipcRenderer.on('ssh:shell:data', handler);
    return () => ipcRenderer.removeListener('ssh:shell:data', handler);
  },

  // SFTP operations
  sftpList: (sessionId, remotePath) =>
    ipcRenderer.invoke('sftp:list', sessionId, remotePath),
  sftpReadFile: (sessionId, remotePath) =>
    ipcRenderer.invoke('sftp:readFile', sessionId, remotePath),
  sftpWriteFile: (sessionId, remotePath, content) =>
    ipcRenderer.invoke('sftp:writeFile', sessionId, remotePath, content),
  sftpRename: (sessionId, oldPath, newPath) =>
    ipcRenderer.invoke('sftp:rename', sessionId, oldPath, newPath),
  sftpDelete: (sessionId, remotePath) =>
    ipcRenderer.invoke('sftp:delete', sessionId, remotePath),
  sftpDeleteDir: (sessionId, remotePath) =>
    ipcRenderer.invoke('sftp:deleteDir', sessionId, remotePath),
  sftpMkdir: (sessionId, remotePath) =>
    ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath),
  sftpDownload: (sessionId, remotePath) =>
    ipcRenderer.invoke('sftp:download', sessionId, remotePath),
  sftpUpload: (sessionId, remotePath, localPath) =>
    ipcRenderer.invoke('sftp:upload', sessionId, remotePath, localPath),
  sftpStat: (sessionId, remotePath) =>
    ipcRenderer.invoke('sftp:stat', sessionId, remotePath),
});

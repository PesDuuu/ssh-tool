const connectionStore = require('../services/connection-store');
const cryptoService = require('../services/crypto-service');

/**
 * Registers IPC handlers for stored connection CRUD and master password operations.
 */
function registerConnectionHandlers(ipcMain) {
  // ── Master password management ───────────────────────────────────────

  // Returns whether the master password is configured and whether the vault is unlocked
  ipcMain.handle('master:status', async () => {
    try {
      return {
        success: true,
        data: {
          isSetup: cryptoService.isMasterPasswordSetup(),
          isUnlocked: cryptoService.isUnlocked(),
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // First-time master password creation
  ipcMain.handle('master:setup', async (_event, password) => {
    try {
      if (cryptoService.isMasterPasswordSetup()) {
        return { success: false, error: 'Master password is already configured' };
      }
      if (!password || password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }
      cryptoService.setupMasterPassword(password);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Unlock the vault with the master password
  ipcMain.handle('master:unlock', async (_event, password) => {
    try {
      const ok = cryptoService.unlockWithMasterPassword(password);
      if (!ok) {
        return { success: false, error: 'Incorrect master password' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Change master password: re-encrypts all stored credentials
  ipcMain.handle('master:changePassword', async (_event, oldPassword, newPassword) => {
    try {
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'New password must be at least 6 characters' };
      }

      // Verify old password matches current master
      const verified = cryptoService.unlockWithMasterPassword(oldPassword);
      if (!verified) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Decrypt all credentials with the current (old) master key
      const decryptedConnections = connectionStore.getAllWithCredentials();

      // Switch to the new master key
      cryptoService.changeMasterPassword(newPassword);

      // Re-encrypt and save every connection with the new key
      for (const conn of decryptedConnections) {
        connectionStore.save(conn);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Connection CRUD ──────────────────────────────────────────────────

  ipcMain.handle('connections:getAll', async () => {
    try {
      return { success: true, data: connectionStore.getAll() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('connections:save', async (_event, connectionData) => {
    try {
      const saved = connectionStore.save(connectionData);
      return { success: true, data: saved };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('connections:delete', async (_event, id) => {
    try {
      connectionStore.remove(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerConnectionHandlers };

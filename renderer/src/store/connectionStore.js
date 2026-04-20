import { create } from 'zustand';

/**
 * Manages master password state, saved server connections, and active SSH session state.
 */
const useConnectionStore = create((set, get) => ({
  // ── Master password state ────────────────────────────────────────────
  // Whether a master password has been configured
  masterIsSetup: false,
  // Whether the vault is currently unlocked
  masterIsUnlocked: false,

  // Check master password status from main process
  checkMasterStatus: async () => {
    const result = await window.electronAPI.masterGetStatus();
    if (result.success) {
      set({
        masterIsSetup: result.data.isSetup,
        masterIsUnlocked: result.data.isUnlocked,
      });
      return result.data;
    }
    throw new Error(result.error);
  },

  // First-time master password setup
  setupMasterPassword: async (password) => {
    const result = await window.electronAPI.masterSetup(password);
    if (result.success) {
      set({ masterIsSetup: true, masterIsUnlocked: true });
      return true;
    }
    throw new Error(result.error);
  },

  // Unlock with existing master password
  unlockMasterPassword: async (password) => {
    const result = await window.electronAPI.masterUnlock(password);
    if (result.success) {
      set({ masterIsUnlocked: true });
      return true;
    }
    throw new Error(result.error);
  },

  // Change master password (re-encrypts all stored data)
  changeMasterPassword: async (oldPassword, newPassword) => {
    const result = await window.electronAPI.masterChangePassword(oldPassword, newPassword);
    if (result.success) return true;
    throw new Error(result.error);
  },

  // ── Connection state ─────────────────────────────────────────────────
  // List of saved connections (without credentials)
  connections: [],
  // Currently active connection ID (from saved connections list)
  activeConnectionId: null,
  // Active SSH session ID (from ssh-service in main process)
  activeSessionId: null,
  // Connection status: 'disconnected' | 'connecting' | 'connected' | 'error'
  status: 'disconnected',
  // Last error message
  error: null,

  // Load saved connections from electron store
  loadConnections: async () => {
    const result = await window.electronAPI.getConnections();
    if (result.success) {
      set({ connections: result.data });
    }
  },

  // Save (create or update) a connection
  saveConnection: async (connectionData) => {
    const result = await window.electronAPI.saveConnection(connectionData);
    if (result.success) {
      await get().loadConnections();
      return result.data;
    }
    throw new Error(result.error);
  },

  // Delete a saved connection
  deleteConnection: async (id) => {
    // Disconnect first if this connection is active
    if (get().activeConnectionId === id) {
      await get().disconnect();
    }
    const result = await window.electronAPI.deleteConnection(id);
    if (result.success) {
      await get().loadConnections();
    }
  },

  // Establish SSH connection to a saved server
  connect: async (connectionId) => {
    set({ status: 'connecting', error: null, activeConnectionId: connectionId });
    try {
      const result = await window.electronAPI.sshConnect({ connectionId });
      if (result.success) {
        set({ activeSessionId: result.sessionId, status: 'connected' });
        return result.sessionId;
      }
      set({ status: 'error', error: result.error, activeConnectionId: null });
      throw new Error(result.error);
    } catch (err) {
      set({ status: 'error', error: err.message, activeConnectionId: null });
      throw err;
    }
  },

  // Disconnect the active SSH session
  disconnect: async () => {
    const { activeSessionId } = get();
    if (activeSessionId) {
      await window.electronAPI.sshDisconnect(activeSessionId);
    }
    set({
      activeSessionId: null,
      activeConnectionId: null,
      status: 'disconnected',
      error: null,
    });
  },

  // Execute a one-off command
  execCommand: async (command) => {
    const { activeSessionId } = get();
    if (!activeSessionId) throw new Error('Not connected');
    const result = await window.electronAPI.sshExec(activeSessionId, command);
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  // Get the active connection object
  getActiveConnection: () => {
    const { connections, activeConnectionId } = get();
    return connections.find((c) => c.id === activeConnectionId) || null;
  },
}));

export default useConnectionStore;

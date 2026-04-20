const Store = require('electron-store');
const { encrypt, decrypt } = require('./crypto-service');
const { v4: uuidv4 } = require('uuid');

let store = null;
const CONNECTIONS_KEY = 'connections';

/**
 * Initializes the connection store with a custom data directory.
 * Must be called before any CRUD operations.
 * @param {string} dataPath - Absolute path to the portable data folder.
 */
function init(dataPath) {
  store = new Store({
    name: 'ssh-connections',
    cwd: dataPath,
  });
}

/**
 * Ensures the store has been initialized before use.
 */
function ensureInit() {
  if (!store) throw new Error('Connection store not initialized. Call init() first.');
}

/**
 * Retrieves all stored connections with sensitive fields masked.
 * Passwords and private keys are replaced with boolean indicators.
 */
function getAll() {
  ensureInit();
  const connections = store.get(CONNECTIONS_KEY, []);
  return connections.map((conn) => ({
    ...conn,
    hasPassword: !!conn.password,
    hasPrivateKey: !!conn.privateKey,
    password: undefined,
    privateKey: undefined,
  }));
}

/**
 * Retrieves a single connection with decrypted credentials (for internal use only).
 */
function getWithCredentials(id) {
  ensureInit();
  const connections = store.get(CONNECTIONS_KEY, []);
  const conn = connections.find((c) => c.id === id);
  if (!conn) return null;

  return {
    ...conn,
    password: conn.password ? decrypt(conn.password) : '',
    privateKey: conn.privateKey ? decrypt(conn.privateKey) : '',
  };
}

/**
 * Retrieves all connections with decrypted credentials.
 * Used internally for master password change re-encryption.
 */
function getAllWithCredentials() {
  ensureInit();
  const connections = store.get(CONNECTIONS_KEY, []);
  return connections.map((conn) => ({
    ...conn,
    password: conn.password ? decrypt(conn.password) : '',
    privateKey: conn.privateKey ? decrypt(conn.privateKey) : '',
  }));
}

/**
 * Saves a connection (create or update). Encrypts password and privateKey before storage.
 */
function save(connectionData) {
  ensureInit();
  const connections = store.get(CONNECTIONS_KEY, []);
  const id = connectionData.id || uuidv4();

  const encrypted = {
    id,
    label: connectionData.label || connectionData.host,
    host: connectionData.host,
    port: parseInt(connectionData.port, 10) || 22,
    username: connectionData.username || 'root',
    authType: connectionData.authType || 'password',
    password: connectionData.password ? encrypt(connectionData.password) : '',
    privateKey: connectionData.privateKey ? encrypt(connectionData.privateKey) : '',
    quickCommands: connectionData.quickCommands || [],
    createdAt: connectionData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = connections.findIndex((c) => c.id === id);
  if (existingIndex >= 0) {
    // Preserve credentials if not provided in update
    if (!connectionData.password && connections[existingIndex].password) {
      encrypted.password = connections[existingIndex].password;
    }
    if (!connectionData.privateKey && connections[existingIndex].privateKey) {
      encrypted.privateKey = connections[existingIndex].privateKey;
    }
    connections[existingIndex] = encrypted;
  } else {
    connections.push(encrypted);
  }

  store.set(CONNECTIONS_KEY, connections);
  return { ...encrypted, password: undefined, privateKey: undefined, hasPassword: !!encrypted.password, hasPrivateKey: !!encrypted.privateKey };
}

/**
 * Deletes a connection by ID.
 */
function remove(id) {
  ensureInit();
  const connections = store.get(CONNECTIONS_KEY, []);
  store.set(
    CONNECTIONS_KEY,
    connections.filter((c) => c.id !== id)
  );
  return true;
}

module.exports = { init, getAll, getWithCredentials, getAllWithCredentials, save, remove };

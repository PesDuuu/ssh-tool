const { Client } = require('ssh2');
const { v4: uuidv4 } = require('uuid');

// Active SSH connections keyed by session ID
const sessions = new Map();
// Active shell streams keyed by terminal ID
const shells = new Map();

/**
 * Establishes an SSH connection and stores it by session ID.
 * Returns the session ID on success.
 */
function connect(config) {
  return new Promise((resolve, reject) => {
    const sessionId = uuidv4();
    const client = new Client();

    const connectionConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 15000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 5,
    };

    // Auth: password or private key
    if (config.authType === 'privateKey' && config.privateKey) {
      connectionConfig.privateKey = config.privateKey;
      if (config.passphrase) {
        connectionConfig.passphrase = config.passphrase;
      }
    } else if (config.password) {
      connectionConfig.password = config.password;
    }

    const timeout = setTimeout(() => {
      client.end();
      reject(new Error('Connection timed out after 15 seconds'));
    }, 16000);

    client.on('ready', () => {
      clearTimeout(timeout);
      sessions.set(sessionId, { client, config: { host: config.host, port: config.port, username: config.username } });
      resolve(sessionId);
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      sessions.delete(sessionId);
      reject(new Error(`SSH connection failed: ${err.message}`));
    });

    client.on('close', () => {
      sessions.delete(sessionId);
    });

    client.connect(connectionConfig);
  });
}

/**
 * Disconnects an SSH session and closes all associated shells.
 */
function disconnect(sessionId) {
  // Close any shells tied to this session
  for (const [termId, shell] of shells.entries()) {
    if (shell.sessionId === sessionId) {
      shell.stream.close();
      shells.delete(termId);
    }
  }

  const session = sessions.get(sessionId);
  if (session) {
    session.client.end();
    sessions.delete(sessionId);
  }
  return true;
}

/**
 * Disconnects all active SSH sessions (used on app quit).
 */
function disconnectAll() {
  for (const [termId, shell] of shells.entries()) {
    try { shell.stream.close(); } catch (_) { /* ignore */ }
    shells.delete(termId);
  }
  for (const [sessionId, session] of sessions.entries()) {
    try { session.client.end(); } catch (_) { /* ignore */ }
    sessions.delete(sessionId);
  }
}

/**
 * Executes a single command on the SSH session and returns stdout/stderr.
 */
function exec(sessionId, command) {
  return new Promise((resolve, reject) => {
    const session = sessions.get(sessionId);
    if (!session) return reject(new Error('Session not found'));

    session.client.exec(command, (err, stream) => {
      if (err) return reject(err);

      let stdout = '';
      let stderr = '';

      stream.on('data', (data) => { stdout += data.toString(); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); });
      stream.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });
    });
  });
}

/**
 * Opens an interactive shell stream for a terminal tab.
 * Data is forwarded to the renderer via IPC event.
 */
function openShell(sessionId, termId, cols, rows, webContents) {
  return new Promise((resolve, reject) => {
    const session = sessions.get(sessionId);
    if (!session) return reject(new Error('Session not found'));

    session.client.shell({ cols, rows, term: 'xterm-256color' }, (err, stream) => {
      if (err) return reject(err);

      shells.set(termId, { stream, sessionId });

      stream.on('data', (data) => {
        try {
          webContents.send('ssh:shell:data', termId, data.toString());
        } catch (_) { /* window might be closed */ }
      });

      stream.on('close', () => {
        shells.delete(termId);
      });

      resolve(true);
    });
  });
}

/**
 * Writes data to an interactive shell stream.
 */
function writeShell(termId, data) {
  const shell = shells.get(termId);
  if (!shell) return false;
  shell.stream.write(data);
  return true;
}

/**
 * Resizes an interactive shell stream.
 */
function resizeShell(termId, cols, rows) {
  const shell = shells.get(termId);
  if (!shell) return false;
  shell.stream.setWindow(rows, cols, 0, 0);
  return true;
}

/**
 * Closes an interactive shell stream.
 */
function closeShell(termId) {
  const shell = shells.get(termId);
  if (!shell) return false;
  shell.stream.close();
  shells.delete(termId);
  return true;
}

/**
 * Returns the raw SSH client for a session (used by SFTP service).
 */
function getClient(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.client : null;
}

module.exports = {
  connect,
  disconnect,
  disconnectAll,
  exec,
  openShell,
  writeShell,
  resizeShell,
  closeShell,
  getClient,
};

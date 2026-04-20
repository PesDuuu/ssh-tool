const sshService = require('./ssh-service');
const path = require('path');

// Cache SFTP instances per session to avoid re-creating
const sftpInstances = new Map();

/**
 * Gets or creates an SFTP instance for the given SSH session.
 */
function getSFTP(sessionId) {
  return new Promise((resolve, reject) => {
    if (sftpInstances.has(sessionId)) {
      return resolve(sftpInstances.get(sessionId));
    }

    const client = sshService.getClient(sessionId);
    if (!client) return reject(new Error('SSH session not found'));

    client.sftp((err, sftp) => {
      if (err) return reject(new Error(`SFTP initialization failed: ${err.message}`));
      sftpInstances.set(sessionId, sftp);

      // Clean up cache when session ends
      client.on('close', () => sftpInstances.delete(sessionId));
      resolve(sftp);
    });
  });
}

/**
 * Lists directory contents, returning file metadata sorted (dirs first, then files).
 */
async function listDirectory(sessionId, remotePath) {
  const sftp = await getSFTP(sessionId);

  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) return reject(new Error(`Failed to list ${remotePath}: ${err.message}`));

      const entries = list
        .filter((item) => item.filename !== '.' && item.filename !== '..')
        .map((item) => ({
          name: item.filename,
          path: remotePath === '/' ? `/${item.filename}` : `${remotePath}/${item.filename}`,
          isDirectory: (item.attrs.mode & 0o40000) !== 0,
          isSymlink: (item.attrs.mode & 0o120000) === 0o120000,
          size: item.attrs.size,
          modified: new Date(item.attrs.mtime * 1000).toISOString(),
          permissions: (item.attrs.mode & 0o777).toString(8),
        }))
        .sort((a, b) => {
          // Directories first, then alphabetical
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      resolve(entries);
    });
  });
}

/**
 * Reads a remote file and returns its content as a UTF-8 string.
 * Guards against reading excessively large files (>10MB).
 */
async function readFile(sessionId, remotePath) {
  const sftp = await getSFTP(sessionId);

  // Check file size first
  const stats = await stat(sessionId, remotePath);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Max is 10MB.`);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    const readStream = sftp.createReadStream(remotePath, { encoding: 'utf8' });

    readStream.on('data', (chunk) => chunks.push(chunk));
    readStream.on('end', () => resolve(chunks.join('')));
    readStream.on('error', (err) => reject(new Error(`Failed to read ${remotePath}: ${err.message}`)));
  });
}

/**
 * Writes content to a remote file. Optionally creates a .bak backup first.
 */
async function writeFile(sessionId, remotePath, content, createBackup = true) {
  const sftp = await getSFTP(sessionId);

  // Create backup if requested and file exists
  if (createBackup) {
    try {
      await statRaw(sftp, remotePath);
      await new Promise((resolve, reject) => {
        const backupPath = `${remotePath}.bak`;
        // Read original then write backup
        const chunks = [];
        const readStream = sftp.createReadStream(remotePath);
        readStream.on('data', (chunk) => chunks.push(chunk));
        readStream.on('end', () => {
          const writeStream = sftp.createWriteStream(backupPath);
          writeStream.end(Buffer.concat(chunks), (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        readStream.on('error', () => resolve()); // No backup if can't read original
      });
    } catch (_) {
      // File doesn't exist yet, no backup needed
    }
  }

  return new Promise((resolve, reject) => {
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.end(Buffer.from(content, 'utf8'), (err) => {
      if (err) return reject(new Error(`Failed to write ${remotePath}: ${err.message}`));
      resolve(true);
    });
  });
}

/**
 * Renames a remote file or directory.
 */
async function rename(sessionId, oldPath, newPath) {
  const sftp = await getSFTP(sessionId);
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) return reject(new Error(`Failed to rename: ${err.message}`));
      resolve(true);
    });
  });
}

/**
 * Deletes a remote file.
 */
async function deleteFile(sessionId, remotePath) {
  const sftp = await getSFTP(sessionId);
  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (err) => {
      if (err) return reject(new Error(`Failed to delete ${remotePath}: ${err.message}`));
      resolve(true);
    });
  });
}

/**
 * Deletes a remote directory (must be empty).
 */
async function deleteDir(sessionId, remotePath) {
  const sftp = await getSFTP(sessionId);
  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (err) => {
      if (err) return reject(new Error(`Failed to delete directory ${remotePath}: ${err.message}`));
      resolve(true);
    });
  });
}

/**
 * Creates a remote directory.
 */
async function mkdir(sessionId, remotePath) {
  const sftp = await getSFTP(sessionId);
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => {
      if (err) return reject(new Error(`Failed to create directory ${remotePath}: ${err.message}`));
      resolve(true);
    });
  });
}

/**
 * Gets file/directory stats.
 */
async function stat(sessionId, remotePath) {
  const sftp = await getSFTP(sessionId);
  return statRaw(sftp, remotePath);
}

function statRaw(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) return reject(new Error(`Failed to stat ${remotePath}: ${err.message}`));
      resolve({
        size: stats.size,
        isDirectory: stats.isDirectory(),
        modified: new Date(stats.mtime * 1000).toISOString(),
        permissions: (stats.mode & 0o777).toString(8),
      });
    });
  });
}

/**
 * Downloads file content as a Buffer (for binary download).
 */
async function downloadFile(sessionId, remotePath) {
  const sftp = await getSFTP(sessionId);
  return new Promise((resolve, reject) => {
    const chunks = [];
    const readStream = sftp.createReadStream(remotePath);
    readStream.on('data', (chunk) => chunks.push(chunk));
    readStream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({ data: buffer.toString('base64'), filename: path.basename(remotePath) });
    });
    readStream.on('error', (err) => reject(new Error(`Download failed: ${err.message}`)));
  });
}

module.exports = {
  listDirectory,
  readFile,
  writeFile,
  rename,
  deleteFile,
  deleteDir,
  mkdir,
  stat,
  downloadFile,
};

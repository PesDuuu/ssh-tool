const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// AES-256-GCM encryption for credential storage
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
// Fixed salt used to derive the encryption key from master password
const MASTER_KEY_SALT = Buffer.from('ssh-tool-master-encryption-key-v1', 'utf8');

let masterKey = null;
let dataPath = null;

/**
 * Initializes the crypto service with the portable data directory path.
 */
function init(dataDirPath) {
  dataPath = dataDirPath;
}

function getMasterFilePath() {
  return path.join(dataPath, 'master.json');
}

/**
 * Checks whether a master password has been configured (master.json exists).
 */
function isMasterPasswordSetup() {
  if (!dataPath) return false;
  return fs.existsSync(getMasterFilePath());
}

/**
 * Checks whether the master key has been loaded into memory (user has unlocked).
 */
function isUnlocked() {
  return masterKey !== null;
}

/**
 * Derives a deterministic encryption key from the master password.
 * Uses a fixed application-level salt so the same password always yields the same key.
 */
function deriveMasterKey(password) {
  return crypto.pbkdf2Sync(password, MASTER_KEY_SALT, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Creates a verification hash of the master password with a random salt.
 * This hash is stored in master.json to verify the password on unlock.
 */
function createVerificationHash(password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

/**
 * Verifies a password against a stored verification hash.
 */
function verifyPasswordHash(password, saltHex, hashHex) {
  const salt = Buffer.from(saltHex, 'hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

/**
 * Sets up the master password for first-time use.
 * Creates master.json with verification hash and loads the encryption key.
 */
function setupMasterPassword(password) {
  if (!dataPath) throw new Error('Crypto service not initialized');

  const verification = createVerificationHash(password);
  const data = {
    salt: verification.salt,
    hash: verification.hash,
    version: 1,
  };

  fs.writeFileSync(getMasterFilePath(), JSON.stringify(data, null, 2), 'utf8');
  masterKey = deriveMasterKey(password);
  return true;
}

/**
 * Attempts to unlock the vault with the given master password.
 * Returns true on success, false on wrong password.
 */
function unlockWithMasterPassword(password) {
  if (!dataPath) throw new Error('Crypto service not initialized');

  const raw = fs.readFileSync(getMasterFilePath(), 'utf8');
  const fileData = JSON.parse(raw);

  if (!verifyPasswordHash(password, fileData.salt, fileData.hash)) {
    return false;
  }

  masterKey = deriveMasterKey(password);
  return true;
}

/**
 * Changes the master password. Updates master.json and returns the new key
 * so the caller can re-encrypt stored credentials.
 * The old master key must already be loaded (caller verifies old password first).
 */
function changeMasterPassword(newPassword) {
  if (!dataPath) throw new Error('Crypto service not initialized');
  if (!masterKey) throw new Error('Not unlocked');

  const verification = createVerificationHash(newPassword);
  const data = {
    salt: verification.salt,
    hash: verification.hash,
    version: 1,
  };

  fs.writeFileSync(getMasterFilePath(), JSON.stringify(data, null, 2), 'utf8');
  masterKey = deriveMasterKey(newPassword);
  return true;
}

/**
 * Derives per-record AES key from the master key + a random per-record salt.
 */
function deriveKey(baseKey, salt) {
  return crypto.pbkdf2Sync(baseKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypts a plaintext string using AES-256-GCM with the master-derived key.
 * Returns a hex-encoded string containing salt + iv + tag + ciphertext.
 * Throws if master password has not been unlocked.
 */
function encrypt(plaintext) {
  if (!plaintext) return '';
  if (!masterKey) throw new Error('Master password not unlocked');

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(masterKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Concatenate: salt (32) + iv (16) + tag (16) + ciphertext
  return salt.toString('hex') + iv.toString('hex') + tag.toString('hex') + encrypted;
}

/**
 * Decrypts a hex-encoded AES-256-GCM ciphertext string.
 * Returns the original plaintext.
 * Throws if master password has not been unlocked.
 */
function decrypt(encryptedHex) {
  if (!encryptedHex) return '';
  if (!masterKey) throw new Error('Master password not unlocked');

  // Extract components from hex string
  const salt = Buffer.from(encryptedHex.slice(0, SALT_LENGTH * 2), 'hex');
  const iv = Buffer.from(encryptedHex.slice(SALT_LENGTH * 2, SALT_LENGTH * 2 + IV_LENGTH * 2), 'hex');
  const tag = Buffer.from(
    encryptedHex.slice(SALT_LENGTH * 2 + IV_LENGTH * 2, SALT_LENGTH * 2 + IV_LENGTH * 2 + TAG_LENGTH * 2),
    'hex'
  );
  const encrypted = encryptedHex.slice(SALT_LENGTH * 2 + IV_LENGTH * 2 + TAG_LENGTH * 2);

  const key = deriveKey(masterKey, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  init,
  isMasterPasswordSetup,
  isUnlocked,
  setupMasterPassword,
  unlockWithMasterPassword,
  changeMasterPassword,
  encrypt,
  decrypt,
};

import React, { useState, useRef, useEffect } from 'react';
import { HiOutlineLockClosed, HiOutlineShieldCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2';

/**
 * Full-screen dialog for master password setup (first launch) and unlock (subsequent launches).
 * Blocks the app UI until the vault is unlocked.
 */
export default function MasterPasswordDialog({ mode, onUnlocked }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus the password input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const isSetup = mode === 'setup';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password) {
      setError('Password is required');
      return;
    }
    if (isSetup) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      await onUnlocked(password);
    } catch (err) {
      setError(err.message || 'Failed to unlock');
      setPassword('');
      setConfirmPassword('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a14]">
      <div className="w-full max-w-sm mx-4">
        {/* Icon and heading */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            {isSetup ? (
              <HiOutlineShieldCheck className="w-8 h-8 text-blue-400" />
            ) : (
              <HiOutlineLockClosed className="w-8 h-8 text-blue-400" />
            )}
          </div>
          <h1 className="text-lg font-semibold text-gray-100">
            {isSetup ? 'Set Master Password' : 'Unlock SSH Tool'}
          </h1>
          <p className="text-xs text-gray-500 mt-2 text-center max-w-xs">
            {isSetup
              ? 'Create a master password to encrypt and protect your stored connections.'
              : 'Enter your master password to access stored connections.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              {isSetup ? 'Master Password' : 'Password'}
            </label>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSetup ? 'Minimum 6 characters' : 'Enter master password'}
              autoComplete="off"
              className="w-full bg-[#14142a] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {isSetup && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="off"
                className="w-full bg-[#14142a] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <HiOutlineExclamationTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? (isSetup ? 'Setting up...' : 'Unlocking...')
              : (isSetup ? 'Set Password' : 'Unlock')}
          </button>
        </form>

        {isSetup && (
          <p className="text-[10px] text-gray-600 text-center mt-4">
            This password cannot be recovered. If forgotten, you must delete the data folder and start fresh.
          </p>
        )}
      </div>
    </div>
  );
}

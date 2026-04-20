import React, { useState, useEffect } from 'react';
import { HiOutlineXMark, HiOutlineKey, HiOutlineLockClosed } from 'react-icons/hi2';
import useConnectionStore from '../store/connectionStore';
import useUIStore from '../store/uiStore';

export default function ConnectionDialog() {
  const isOpen = useUIStore((s) => s.connectionDialogOpen);
  const editingConnection = useUIStore((s) => s.editingConnection);
  const closeDialog = useUIStore((s) => s.closeConnectionDialog);
  const saveConnection = useConnectionStore((s) => s.saveConnection);
  const addToast = useUIStore((s) => s.addToast);

  const [form, setForm] = useState({
    label: '',
    host: '',
    port: '22',
    username: 'root',
    authType: 'password',
    password: '',
    privateKey: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingConnection) {
      setForm({
        label: editingConnection.label || '',
        host: editingConnection.host || '',
        port: String(editingConnection.port || 22),
        username: editingConnection.username || 'root',
        authType: editingConnection.authType || 'password',
        password: '',
        privateKey: '',
      });
    } else {
      setForm({ label: '', host: '', port: '22', username: 'root', authType: 'password', password: '', privateKey: '' });
    }
  }, [editingConnection, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.host) return;

    setSaving(true);
    try {
      await saveConnection({
        ...(editingConnection ? { id: editingConnection.id } : {}),
        ...form,
        port: parseInt(form.port, 10) || 22,
      });
      addToast(editingConnection ? 'Connection updated' : 'Connection saved', 'success');
      closeDialog();
    } catch (err) {
      addToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#14142a] rounded-xl border border-gray-700/50 shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-sm font-semibold text-gray-200">
            {editingConnection ? 'Edit Connection' : 'New Connection'}
          </h2>
          <button onClick={closeDialog} className="p-1 hover:bg-gray-700 rounded transition-colors">
            <HiOutlineXMark className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Label (optional)</label>
            <input type="text" value={form.label}
                   onChange={(e) => setForm({ ...form, label: e.target.value })}
                   placeholder="My Server"
                   className="w-full bg-[#0a0a14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Host *</label>
              <input type="text" value={form.host} required
                     onChange={(e) => setForm({ ...form, host: e.target.value })}
                     placeholder="192.168.1.1"
                     className="w-full bg-[#0a0a14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Port</label>
              <input type="number" value={form.port}
                     onChange={(e) => setForm({ ...form, port: e.target.value })}
                     className="w-full bg-[#0a0a14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
            <input type="text" value={form.username}
                   onChange={(e) => setForm({ ...form, username: e.target.value })}
                   className="w-full bg-[#0a0a14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30" />
          </div>

          {/* Auth type toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Authentication</label>
            <div className="flex gap-2">
              <button type="button"
                      onClick={() => setForm({ ...form, authType: 'password' })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${form.authType === 'password'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}>
                <HiOutlineLockClosed className="w-3.5 h-3.5" /> Password
              </button>
              <button type="button"
                      onClick={() => setForm({ ...form, authType: 'privateKey' })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${form.authType === 'privateKey'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}>
                <HiOutlineKey className="w-3.5 h-3.5" /> Private Key
              </button>
            </div>
          </div>

          {form.authType === 'password' ? (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Password {editingConnection?.hasPassword && <span className="text-gray-600">(leave blank to keep current)</span>}
              </label>
              <input type="password" value={form.password}
                     onChange={(e) => setForm({ ...form, password: e.target.value })}
                     placeholder={editingConnection?.hasPassword ? '••••••••' : 'Enter password'}
                     className="w-full bg-[#0a0a14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Private Key {editingConnection?.hasPrivateKey && <span className="text-gray-600">(leave blank to keep current)</span>}
              </label>
              <textarea value={form.privateKey}
                        onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                        placeholder="Paste your private key here..."
                        rows={4}
                        className="w-full bg-[#0a0a14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 font-mono text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none" />
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeDialog}
                    className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.host}
                    className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving...' : editingConnection ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

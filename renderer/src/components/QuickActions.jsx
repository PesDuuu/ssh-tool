import React, { useState } from 'react';
import {
  HiOutlineCommandLine, HiOutlinePlay, HiOutlinePlus,
  HiOutlineTrash, HiOutlinePencilSquare, HiOutlineXMark,
  HiOutlineCheck, HiOutlineArrowUturnLeft, HiOutlineFolderOpen
} from 'react-icons/hi2';
import useConnectionStore from '../store/connectionStore';
import useUIStore from '../store/uiStore';
import useQuickActionStore from '../store/quickActionStore';

// Available emoji icons for command selection
const ICON_OPTIONS = ['🔧', '🔄', '🐳', '⚡', '💾', '🧠', '⏱️', '🚀', '📦', '🔥', '🛠️', '📋', '🗂️', '🌐', '⚙️', '🔒'];

/**
 * Wraps a command with `cd <cwd> &&` if a working directory is specified.
 * This ensures the command runs in the correct project folder on the remote server.
 */
function buildExecutableCommand(command, cwd) {
  if (!cwd?.trim()) return command;
  return `cd ${cwd.trim()} && ${command}`;
}

export default function QuickActions() {
  const execCommand = useConnectionStore((s) => s.execCommand);
  const addToast = useUIStore((s) => s.addToast);
  const commands = useQuickActionStore((s) => s.commands);
  const addCommand = useQuickActionStore((s) => s.addCommand);
  const updateCommand = useQuickActionStore((s) => s.updateCommand);
  const removeCommand = useQuickActionStore((s) => s.removeCommand);
  const restoreBuiltins = useQuickActionStore((s) => s.restoreBuiltins);
  const removedBuiltinIds = useQuickActionStore((s) => s.removedBuiltinIds);

  const [results, setResults] = useState({});
  const [running, setRunning] = useState(null);
  const [customCommand, setCustomCommand] = useState('');

  // Edit/Create form state
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [formData, setFormData] = useState({ id: null, label: '', command: '', icon: '🔧', cwd: '' });
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Execute a quick action command via SSH, prepending cd if cwd is set
  const handleRun = async (cmd) => {
    setRunning(cmd.id || cmd.command);
    try {
      const fullCommand = buildExecutableCommand(cmd.command, cmd.cwd);
      const result = await execCommand(fullCommand);
      setResults((prev) => ({
        ...prev,
        [cmd.id || cmd.command]: {
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.code,
        },
      }));
      if (result.code !== 0) {
        addToast(`Command exited with code ${result.code}`, 'warning');
      }
    } catch (err) {
      addToast(`Command failed: ${err.message}`, 'error');
      setResults((prev) => ({
        ...prev,
        [cmd.id || cmd.command]: { stderr: err.message, code: -1 },
      }));
    } finally {
      setRunning(null);
    }
  };

  // Run the inline custom command input
  const handleCustomRun = (e) => {
    e.preventDefault();
    if (!customCommand.trim()) return;
    handleRun({ id: `custom-${Date.now()}`, command: customCommand.trim(), cwd: '' });
  };

  // Open the create form
  const openCreateForm = () => {
    setFormData({ id: null, label: '', command: '', icon: '🔧', cwd: '' });
    setFormMode('create');
    setShowIconPicker(false);
  };

  // Open the edit form pre-filled with existing command data
  const openEditForm = (cmd) => {
    setFormData({ id: cmd.id, label: cmd.label, command: cmd.command, icon: cmd.icon, cwd: cmd.cwd || '' });
    setFormMode('edit');
    setShowIconPicker(false);
  };

  // Save the form (create or update)
  const handleFormSave = () => {
    if (!formData.label.trim() || !formData.command.trim()) {
      addToast('Label and command are required', 'warning');
      return;
    }

    if (formMode === 'create') {
      addCommand({ label: formData.label, command: formData.command, icon: formData.icon, cwd: formData.cwd });
      addToast('Quick action created', 'success');
    } else if (formMode === 'edit') {
      updateCommand(formData.id, { label: formData.label, command: formData.command, icon: formData.icon, cwd: formData.cwd });
      addToast('Quick action updated', 'success');
    }

    setFormMode(null);
    setFormData({ id: null, label: '', command: '', icon: '🔧', cwd: '' });
  };

  // Cancel form without saving
  const handleFormCancel = () => {
    setFormMode(null);
    setFormData({ id: null, label: '', command: '', icon: '🔧', cwd: '' });
    setShowIconPicker(false);
  };

  // Delete any command (builtin or custom) with confirmation
  const handleDelete = (cmd) => {
    if (!confirm(`Delete "${cmd.label}"?`)) return;
    removeCommand(cmd.id);
    addToast('Quick action deleted', 'success');
  };

  // Restore all removed builtin commands
  const handleRestoreBuiltins = () => {
    restoreBuiltins();
    addToast('Default actions restored', 'success');
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Actions</span>
        <div className="flex gap-1">
          {/* Show restore button only when some builtins have been removed */}
          {removedBuiltinIds.length > 0 && (
            <button
              onClick={handleRestoreBuiltins}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-yellow-400 transition-colors"
              title="Restore default actions"
            >
              <HiOutlineArrowUturnLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={openCreateForm}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400 transition-colors"
            title="Add new quick action"
          >
            <HiOutlinePlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Create / Edit form */}
      {formMode && (
        <div className="mx-2 mb-3 p-3 bg-[#0a0a14] border border-gray-700 rounded-lg space-y-2">
          <div className="text-xs font-medium text-gray-300 mb-1">
            {formMode === 'create' ? 'New Quick Action' : 'Edit Quick Action'}
          </div>

          {/* Icon picker + Label row */}
          <div className="flex gap-1.5 items-start">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-md text-sm transition-colors"
                title="Pick icon"
              >
                {formData.icon}
              </button>
              {showIconPicker && (
                <div className="absolute top-9 left-0 z-50 bg-[#1e1e2e] border border-gray-700 rounded-lg shadow-xl p-2 grid grid-cols-4 gap-1 min-w-[140px]">
                  {ICON_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { setFormData((d) => ({ ...d, icon: emoji })); setShowIconPicker(false); }}
                      className={`w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 text-sm transition-colors
                        ${formData.icon === emoji ? 'bg-blue-600/30 ring-1 ring-blue-500' : ''}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData((d) => ({ ...d, label: e.target.value }))}
              placeholder="Label (e.g. Pull Frontend)"
              className="flex-1 bg-[#12121f] border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Command input */}
          <input
            type="text"
            value={formData.command}
            onChange={(e) => setFormData((d) => ({ ...d, command: e.target.value }))}
            placeholder="Command (e.g. git pull)"
            className="w-full bg-[#12121f] border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />

          {/* Working directory input */}
          <div className="flex items-center gap-1.5">
            <HiOutlineFolderOpen className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              value={formData.cwd}
              onChange={(e) => setFormData((d) => ({ ...d, cwd: e.target.value }))}
              placeholder="Working directory (optional, e.g. /var/www/myapp)"
              className="flex-1 bg-[#12121f] border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFormSave();
                if (e.key === 'Escape') handleFormCancel();
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              onClick={handleFormCancel}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-md transition-colors"
            >
              <HiOutlineXMark className="w-3 h-3" />
              Cancel
            </button>
            <button
              onClick={handleFormSave}
              disabled={!formData.label.trim() || !formData.command.trim()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <HiOutlineCheck className="w-3 h-3" />
              {formMode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Custom command input */}
      <form onSubmit={handleCustomRun} className="px-2 mb-3">
        <div className="flex gap-1">
          <input
            type="text"
            value={customCommand}
            onChange={(e) => setCustomCommand(e.target.value)}
            placeholder="Run custom command..."
            className="flex-1 bg-[#0a0a14] border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button type="submit" disabled={!customCommand.trim() || running}
                  className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-md transition-colors disabled:opacity-50">
            <HiOutlinePlay className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Command list */}
      <div className="space-y-1 px-1">
        {commands.map((cmd) => {
          const result = results[cmd.id];
          const isRunning = running === cmd.id;

          return (
            <div key={cmd.id} className="rounded-lg overflow-hidden group/cmd">
              <div className="flex items-center">
                <button
                  onClick={() => handleRun(cmd)}
                  disabled={isRunning}
                  className="flex-1 flex items-center gap-2 px-2 py-2 text-left hover:bg-gray-800/40 rounded-md transition-colors disabled:opacity-50 min-w-0"
                >
                  <span className="text-sm flex-shrink-0">{cmd.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-300">{cmd.label}</div>
                    <div className="text-xs text-gray-500 font-mono truncate">{cmd.command}</div>
                    {/* Show working directory if set */}
                    {cmd.cwd && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <HiOutlineFolderOpen className="w-2.5 h-2.5 text-gray-600 flex-shrink-0" />
                        <span className="text-[10px] text-gray-600 font-mono truncate">{cmd.cwd}</span>
                      </div>
                    )}
                  </div>
                  {isRunning ? (
                    <HiOutlineCommandLine className="w-3.5 h-3.5 text-blue-400 animate-pulse flex-shrink-0" />
                  ) : (
                    <HiOutlinePlay className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  )}
                </button>

                {/* Edit/Delete actions (visible on hover) */}
                <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover/cmd:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => openEditForm(cmd)}
                    className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-blue-400 transition-colors"
                    title="Edit"
                  >
                    <HiOutlinePencilSquare className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(cmd)}
                    className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <HiOutlineTrash className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Command output */}
              {result && (
                <div className="mx-2 mb-1 p-2 bg-[#0a0a14] rounded border border-gray-800 max-h-32 overflow-y-auto">
                  {result.stdout && (
                    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">{result.stdout}</pre>
                  )}
                  {result.stderr && (
                    <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-all">{result.stderr}</pre>
                  )}
                  {result.code !== undefined && result.code !== 0 && (
                    <div className="text-xs text-yellow-500 mt-1">Exit code: {result.code}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

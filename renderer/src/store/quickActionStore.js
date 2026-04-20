import { create } from 'zustand';

// Storage keys for localStorage persistence
const STORAGE_KEY = 'ssh-tool:quick-actions';
const REMOVED_BUILTINS_KEY = 'ssh-tool:removed-builtins';

// Built-in commands that ship with the app
const BUILTIN_COMMANDS = [
  { id: 'git-pull', label: 'Git Pull', command: 'git pull', icon: '🔄', cwd: '', builtin: true },
  { id: 'docker-restart', label: 'Docker Compose Restart', command: 'docker compose restart', icon: '🐳', cwd: '', builtin: true },
  { id: 'pm2-restart', label: 'PM2 Restart All', command: 'pm2 restart all', icon: '⚡', cwd: '', builtin: true },
  { id: 'disk-usage', label: 'Disk Usage', command: 'df -h', icon: '💾', cwd: '', builtin: true },
  { id: 'memory', label: 'Memory Usage', command: 'free -m', icon: '🧠', cwd: '', builtin: true },
  { id: 'uptime', label: 'Uptime', command: 'uptime', icon: '⏱️', cwd: '', builtin: true },
];

/**
 * Loads persisted custom commands from localStorage.
 * Falls back to empty array on parse error.
 */
function loadCustomCommands() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Loads the set of removed builtin command IDs from localStorage.
 */
function loadRemovedBuiltins() {
  try {
    const raw = localStorage.getItem(REMOVED_BUILTINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Persists custom commands to localStorage.
 */
function saveCustomCommands(commands) {
  try {
    const custom = commands.filter((c) => !c.builtin);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // Silently ignore storage failures
  }
}

/**
 * Persists the set of removed builtin IDs to localStorage.
 */
function saveRemovedBuiltins(removedIds) {
  try {
    localStorage.setItem(REMOVED_BUILTINS_KEY, JSON.stringify(removedIds));
  } catch {
    // Silently ignore storage failures
  }
}

/**
 * Builds the initial command list: builtins (minus removed ones) + custom.
 */
function buildInitialCommands() {
  const removedIds = loadRemovedBuiltins();
  const visibleBuiltins = BUILTIN_COMMANDS.filter((c) => !removedIds.includes(c.id));
  return [...visibleBuiltins, ...loadCustomCommands()];
}

/**
 * Manages quick action commands: both built-in and user-created.
 * Custom commands and removed-builtin tracking persist to localStorage.
 */
const useQuickActionStore = create((set, get) => ({
  commands: buildInitialCommands(),
  // Track which builtin IDs were removed
  removedBuiltinIds: loadRemovedBuiltins(),

  // Add a new custom command with optional working directory
  addCommand: ({ label, command, icon, cwd }) => {
    if (!label?.trim() || !command?.trim()) return;

    const newCmd = {
      id: `custom-${Date.now()}`,
      label: label.trim(),
      command: command.trim(),
      icon: icon || '🔧',
      cwd: cwd?.trim() || '',
      builtin: false,
    };

    set((state) => {
      const updated = [...state.commands, newCmd];
      saveCustomCommands(updated);
      return { commands: updated };
    });
  },

  // Update an existing command (works for both builtin and custom)
  updateCommand: (id, { label, command, icon, cwd }) => {
    if (!label?.trim() || !command?.trim()) return;

    set((state) => {
      const updated = state.commands.map((cmd) => {
        if (cmd.id !== id) return cmd;
        return {
          ...cmd,
          label: label.trim(),
          command: command.trim(),
          icon: icon || cmd.icon,
          cwd: cwd?.trim() || '',
        };
      });
      saveCustomCommands(updated);
      return { commands: updated };
    });
  },

  // Remove any command (builtin or custom)
  removeCommand: (id) => {
    set((state) => {
      const cmd = state.commands.find((c) => c.id === id);
      const updated = state.commands.filter((c) => c.id !== id);

      // If removing a builtin, track it so it stays removed after reload
      let removedBuiltinIds = state.removedBuiltinIds;
      if (cmd?.builtin) {
        removedBuiltinIds = [...removedBuiltinIds, id];
        saveRemovedBuiltins(removedBuiltinIds);
      }

      saveCustomCommands(updated);
      return { commands: updated, removedBuiltinIds };
    });
  },

  // Restore all removed builtin commands back to the list
  restoreBuiltins: () => {
    set((state) => {
      const currentIds = new Set(state.commands.map((c) => c.id));
      const restored = BUILTIN_COMMANDS.filter((c) => !currentIds.has(c.id));
      const updated = [...restored, ...state.commands];
      saveRemovedBuiltins([]);
      return { commands: updated, removedBuiltinIds: [] };
    });
  },
}));

export default useQuickActionStore;

import { create } from 'zustand';

// Storage key for localStorage persistence
const STORAGE_KEY = 'ssh-tool:quick-actions';

// Built-in commands that ship with the app
const BUILTIN_COMMANDS = [
  { id: 'git-pull', label: 'Git Pull', command: 'git pull', icon: '🔄', builtin: true },
  { id: 'docker-restart', label: 'Docker Compose Restart', command: 'docker compose restart', icon: '🐳', builtin: true },
  { id: 'pm2-restart', label: 'PM2 Restart All', command: 'pm2 restart all', icon: '⚡', builtin: true },
  { id: 'disk-usage', label: 'Disk Usage', command: 'df -h', icon: '💾', builtin: true },
  { id: 'memory', label: 'Memory Usage', command: 'free -m', icon: '🧠', builtin: true },
  { id: 'uptime', label: 'Uptime', command: 'uptime', icon: '⏱️', builtin: true },
];

/**
 * Loads persisted custom commands from localStorage.
 * Falls back to empty array on parse error.
 */
function loadFromStorage() {
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
 * Persists custom commands to localStorage.
 */
function saveToStorage(commands) {
  try {
    // Only persist non-builtin commands
    const custom = commands.filter((c) => !c.builtin);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // Silently ignore storage failures
  }
}

/**
 * Manages quick action commands: both built-in and user-created.
 * Custom commands persist to localStorage.
 */
const useQuickActionStore = create((set, get) => ({
  // Merged list: builtins first, then custom
  commands: [...BUILTIN_COMMANDS, ...loadFromStorage()],

  // Add a new custom command
  addCommand: ({ label, command, icon }) => {
    if (!label?.trim() || !command?.trim()) return;

    const newCmd = {
      id: `custom-${Date.now()}`,
      label: label.trim(),
      command: command.trim(),
      icon: icon || '🔧',
      builtin: false,
    };

    set((state) => {
      const updated = [...state.commands, newCmd];
      saveToStorage(updated);
      return { commands: updated };
    });
  },

  // Update an existing command (works for both builtin and custom)
  updateCommand: (id, { label, command, icon }) => {
    if (!label?.trim() || !command?.trim()) return;

    set((state) => {
      const updated = state.commands.map((cmd) => {
        if (cmd.id !== id) return cmd;
        return {
          ...cmd,
          label: label.trim(),
          command: command.trim(),
          icon: icon || cmd.icon,
        };
      });
      saveToStorage(updated);
      return { commands: updated };
    });
  },

  // Remove a command by id (only non-builtin can be fully removed)
  removeCommand: (id) => {
    set((state) => {
      const updated = state.commands.filter((cmd) => cmd.id !== id);
      saveToStorage(updated);
      return { commands: updated };
    });
  },

  // Reset a builtin command back to its default values
  resetCommand: (id) => {
    const original = BUILTIN_COMMANDS.find((c) => c.id === id);
    if (!original) return;

    set((state) => {
      const updated = state.commands.map((cmd) =>
        cmd.id === id ? { ...original } : cmd
      );
      saveToStorage(updated);
      return { commands: updated };
    });
  },
}));

export default useQuickActionStore;

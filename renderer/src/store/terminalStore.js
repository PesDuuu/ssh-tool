import { create } from 'zustand';

let terminalIdCounter = 0;

/**
 * Manages multiple terminal tabs and their lifecycle.
 */
const useTerminalStore = create((set, get) => ({
  // Terminal tabs: [{ id, title, sessionId }]
  terminals: [],
  // Index of the currently active terminal tab
  activeTerminalIndex: -1,

  // Create a new terminal tab
  addTerminal: (sessionId) => {
    terminalIdCounter += 1;
    const id = `term-${terminalIdCounter}`;
    const terminal = {
      id,
      title: `Terminal ${terminalIdCounter}`,
      sessionId,
    };

    set((state) => ({
      terminals: [...state.terminals, terminal],
      activeTerminalIndex: state.terminals.length,
    }));

    return terminal;
  },

  // Close a terminal tab
  closeTerminal: async (index) => {
    const { terminals } = get();
    const term = terminals[index];
    if (term) {
      await window.electronAPI.sshShellClose(term.id);
    }

    set((state) => {
      const terminals = state.terminals.filter((_, i) => i !== index);
      let activeTerminalIndex = state.activeTerminalIndex;
      if (index <= activeTerminalIndex) {
        activeTerminalIndex = Math.max(0, activeTerminalIndex - 1);
      }
      if (terminals.length === 0) activeTerminalIndex = -1;
      return { terminals, activeTerminalIndex };
    });
  },

  // Set active terminal
  setActiveTerminal: (index) => set({ activeTerminalIndex: index }),

  // Clear all terminals (on disconnect)
  reset: () => {
    const { terminals } = get();
    terminals.forEach((term) => {
      try { window.electronAPI.sshShellClose(term.id); } catch (_) { /* ignore */ }
    });
    set({ terminals: [], activeTerminalIndex: -1 });
    terminalIdCounter = 0;
  },
}));

export default useTerminalStore;

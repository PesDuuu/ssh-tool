import { create } from 'zustand';

/**
 * Manages the file explorer tree, open editor tabs, and file content cache.
 */
const useFileStore = create((set, get) => ({
  // File tree: map of path -> { entries: [], loaded: bool, expanded: bool }
  tree: {},
  // Currently expanded paths for the tree view
  expandedPaths: new Set(),
  // Open editor tabs: [{ path, name, content, originalContent, language, isDirty }]
  tabs: [],
  // Index of the currently active tab
  activeTabIndex: -1,
  // Loading states
  loadingPath: null,
  savingPath: null,

  // Load directory listing from SFTP
  loadDirectory: async (sessionId, remotePath) => {
    set({ loadingPath: remotePath });
    try {
      const result = await window.electronAPI.sftpList(sessionId, remotePath);
      if (result.success) {
        set((state) => ({
          tree: {
            ...state.tree,
            [remotePath]: { entries: result.data, loaded: true },
          },
          loadingPath: null,
        }));
        return result.data;
      }
      set({ loadingPath: null });
      throw new Error(result.error);
    } catch (err) {
      set({ loadingPath: null });
      throw err;
    }
  },

  // Toggle directory expansion in the tree view
  toggleExpand: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedPaths: newExpanded };
    });
  },

  // Open a file in a new editor tab (or activate existing tab)
  openFile: async (sessionId, remotePath, fileName) => {
    const { tabs } = get();

    // Check if already open
    const existingIndex = tabs.findIndex((t) => t.path === remotePath);
    if (existingIndex >= 0) {
      set({ activeTabIndex: existingIndex });
      return;
    }

    // Read file content from server
    const result = await window.electronAPI.sftpReadFile(sessionId, remotePath);
    if (!result.success) throw new Error(result.error);

    const language = detectLanguage(fileName);
    const newTab = {
      path: remotePath,
      name: fileName,
      content: result.data,
      originalContent: result.data,
      language,
      isDirty: false,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabIndex: state.tabs.length,
    }));
  },

  // Update content of the active tab (from editor onChange)
  updateTabContent: (index, newContent) => {
    set((state) => {
      const tabs = [...state.tabs];
      if (!tabs[index]) return state;
      tabs[index] = {
        ...tabs[index],
        content: newContent,
        isDirty: newContent !== tabs[index].originalContent,
      };
      return { tabs };
    });
  },

  // Save the active tab's content to the server
  saveFile: async (sessionId, tabIndex) => {
    const { tabs } = get();
    const tab = tabs[tabIndex];
    if (!tab) return;

    set({ savingPath: tab.path });
    try {
      const result = await window.electronAPI.sftpWriteFile(sessionId, tab.path, tab.content);
      if (!result.success) throw new Error(result.error);

      set((state) => {
        const updatedTabs = [...state.tabs];
        updatedTabs[tabIndex] = {
          ...updatedTabs[tabIndex],
          originalContent: updatedTabs[tabIndex].content,
          isDirty: false,
        };
        return { tabs: updatedTabs, savingPath: null };
      });
    } catch (err) {
      set({ savingPath: null });
      throw err;
    }
  },

  // Close a tab
  closeTab: (index) => {
    set((state) => {
      const tabs = state.tabs.filter((_, i) => i !== index);
      let activeTabIndex = state.activeTabIndex;
      if (index <= activeTabIndex) {
        activeTabIndex = Math.max(0, activeTabIndex - 1);
      }
      if (tabs.length === 0) activeTabIndex = -1;
      return { tabs, activeTabIndex };
    });
  },

  // Set active tab
  setActiveTab: (index) => set({ activeTabIndex: index }),

  // Clear all file state (on disconnect)
  reset: () => set({
    tree: {},
    expandedPaths: new Set(),
    tabs: [],
    activeTabIndex: -1,
    loadingPath: null,
    savingPath: null,
  }),

  // Invalidate a directory listing (force refresh)
  invalidateDirectory: (path) => {
    set((state) => {
      const tree = { ...state.tree };
      delete tree[path];
      return { tree };
    });
  },
}));

/**
 * Detects Monaco editor language from file extension.
 */
function detectLanguage(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    sql: 'sql',
    php: 'php',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    conf: 'ini',
    ini: 'ini',
    toml: 'ini',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    env: 'plaintext',
    txt: 'plaintext',
    log: 'plaintext',
    gitignore: 'plaintext',
    dockerignore: 'plaintext',
  };

  // Special filename matches
  const nameMap = {
    Dockerfile: 'dockerfile',
    Makefile: 'makefile',
    '.gitignore': 'plaintext',
    '.dockerignore': 'plaintext',
    '.env': 'plaintext',
    '.env.local': 'plaintext',
    '.env.production': 'plaintext',
  };

  return nameMap[filename] || languageMap[ext] || 'plaintext';
}

export default useFileStore;

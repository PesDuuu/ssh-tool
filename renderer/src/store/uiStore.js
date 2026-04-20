import { create } from 'zustand';

/**
 * Manages UI-level state: panel visibility, active views, toast notifications.
 */
const useUIStore = create((set, get) => ({
  // 'editor' | 'terminal' | 'monitor'
  mainView: 'editor',
  // Whether the sidebar is visible
  sidebarVisible: true,
  // Sidebar width for resize
  sidebarWidth: 280,
  // Whether the connection dialog is open
  connectionDialogOpen: false,
  // Connection being edited (null for new)
  editingConnection: null,
  // Toast notifications queue
  toasts: [],

  setMainView: (view) => set({ mainView: view }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  openConnectionDialog: (connection = null) =>
    set({ connectionDialogOpen: true, editingConnection: connection }),
  closeConnectionDialog: () =>
    set({ connectionDialogOpen: false, editingConnection: null }),

  // Toast notification system
  addToast: (message, type = 'info', duration = 4000) => {
    const id = Date.now();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export default useUIStore;

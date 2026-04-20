import React, { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import MainPanel from './components/MainPanel';
import ConnectionDialog from './components/ConnectionDialog';
import MasterPasswordDialog from './components/MasterPasswordDialog';
import ToastContainer from './components/ToastContainer';
import useConnectionStore from './store/connectionStore';
import useUIStore from './store/uiStore';

export default function App() {
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const checkMasterStatus = useConnectionStore((s) => s.checkMasterStatus);
  const setupMasterPassword = useConnectionStore((s) => s.setupMasterPassword);
  const unlockMasterPassword = useConnectionStore((s) => s.unlockMasterPassword);
  const masterIsSetup = useConnectionStore((s) => s.masterIsSetup);
  const masterIsUnlocked = useConnectionStore((s) => s.masterIsUnlocked);
  const sidebarVisible = useUIStore((s) => s.sidebarVisible);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);

  // 'loading' while checking master status, then 'ready' once determined
  const [initState, setInitState] = useState('loading');

  // Check master password status on app mount
  useEffect(() => {
    checkMasterStatus()
      .then(() => setInitState('ready'))
      .catch(() => setInitState('ready'));
  }, [checkMasterStatus]);

  // Load connections once the vault is unlocked
  useEffect(() => {
    if (masterIsUnlocked) {
      loadConnections();
    }
  }, [masterIsUnlocked, loadConnections]);

  // Handle master password submission (setup or unlock)
  const handleMasterPassword = async (password) => {
    if (!masterIsSetup) {
      await setupMasterPassword(password);
    } else {
      await unlockMasterPassword(password);
    }
  };

  // Show nothing while checking initial status
  if (initState === 'loading') {
    return <div className="h-screen bg-[#0a0a14]" />;
  }

  // Show master password dialog if vault is locked
  if (!masterIsUnlocked) {
    return (
      <MasterPasswordDialog
        mode={masterIsSetup ? 'unlock' : 'setup'}
        onUnlocked={handleMasterPassword}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a14] text-gray-100 select-none">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarVisible && (
          <div style={{ width: sidebarWidth, minWidth: 220, maxWidth: 500 }} className="flex-shrink-0">
            <Sidebar />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <MainPanel />
        </div>
      </div>
      <ConnectionDialog />
      <ToastContainer />
    </div>
  );
}

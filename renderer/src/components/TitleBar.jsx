import React from 'react';
import { VscChromeMinimize, VscChromeMaximize, VscChromeClose } from 'react-icons/vsc';
import { HiOutlineServerStack } from 'react-icons/hi2';
import useConnectionStore from '../store/connectionStore';
import useUIStore from '../store/uiStore';

export default function TitleBar() {
  const status = useConnectionStore((s) => s.status);
  const getActiveConnection = useConnectionStore((s) => s.getActiveConnection);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const activeConn = getActiveConnection();

  const statusColors = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-emerald-500',
    error: 'bg-red-500',
  };

  return (
    <div className="h-10 bg-[#0d0d1a] flex items-center justify-between border-b border-gray-800/50 app-drag-region"
         style={{ WebkitAppRegion: 'drag' }}>
      {/* Left section: logo + server info */}
      <div className="flex items-center gap-3 px-4" style={{ WebkitAppRegion: 'no-drag' }}>
        <button onClick={toggleSidebar} className="hover:bg-gray-800 p-1 rounded transition-colors" title="Toggle sidebar">
          <HiOutlineServerStack className="w-4 h-4 text-blue-400" />
        </button>
        <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">SSH Tool</span>

        {activeConn && (
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-700">
            <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
            <span className="text-xs text-gray-300">
              {activeConn.label || activeConn.host}
              <span className="text-gray-500 ml-1">({activeConn.username}@{activeConn.host})</span>
            </span>
          </div>
        )}
        {!activeConn && status === 'disconnected' && (
          <span className="text-xs text-gray-500 ml-2 pl-3 border-l border-gray-800">No connection</span>
        )}
      </div>

      {/* Window controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' }}>
        <button onClick={() => window.electronAPI.minimize()}
                className="h-10 w-12 flex items-center justify-center hover:bg-gray-700/50 transition-colors">
          <VscChromeMinimize className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => window.electronAPI.maximize()}
                className="h-10 w-12 flex items-center justify-center hover:bg-gray-700/50 transition-colors">
          <VscChromeMaximize className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => window.electronAPI.close()}
                className="h-10 w-12 flex items-center justify-center hover:bg-red-600/80 transition-colors">
          <VscChromeClose className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

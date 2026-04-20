import React from 'react';
import { HiOutlineCodeBracket, HiOutlineCommandLine, HiOutlineCpuChip } from 'react-icons/hi2';
import EditorPanel from './EditorPanel';
import TerminalPanel from './TerminalPanel';
import SystemMonitorPanel from './SystemMonitorPanel';
import useUIStore from '../store/uiStore';
import useConnectionStore from '../store/connectionStore';

export default function MainPanel() {
  const mainView = useUIStore((s) => s.mainView);
  const setMainView = useUIStore((s) => s.setMainView);
  const status = useConnectionStore((s) => s.status);

  if (status !== 'connected') {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a14]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto">
            <HiOutlineCommandLine className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-lg font-medium text-gray-400">No Active Connection</h2>
          <p className="text-sm text-gray-600 max-w-xs">
            Select a server from the sidebar to connect and start working.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a14]">
      {/* View toggle bar */}
      <div className="flex items-center border-b border-gray-800/50 bg-[#0d0d1a]">
        <button
          onClick={() => setMainView('editor')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2
            ${mainView === 'editor'
              ? 'text-blue-400 border-blue-400 bg-blue-400/5'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
            }`}
        >
          <HiOutlineCodeBracket className="w-3.5 h-3.5" /> Editor
        </button>
        <button
          onClick={() => setMainView('terminal')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2
            ${mainView === 'terminal'
              ? 'text-blue-400 border-blue-400 bg-blue-400/5'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
            }`}
        >
          <HiOutlineCommandLine className="w-3.5 h-3.5" /> Terminal
        </button>
        <button
          onClick={() => setMainView('monitor')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2
            ${mainView === 'monitor'
              ? 'text-blue-400 border-blue-400 bg-blue-400/5'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
            }`}
        >
          <HiOutlineCpuChip className="w-3.5 h-3.5" /> Monitor
        </button>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-hidden">
        {mainView === 'editor' && <EditorPanel />}
        {mainView === 'terminal' && <TerminalPanel />}
        {mainView === 'monitor' && <SystemMonitorPanel />}
      </div>
    </div>
  );
}

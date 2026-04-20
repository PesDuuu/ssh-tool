import React, { useState } from 'react';
import ServerList from './ServerList';
import FileExplorer from './FileExplorer';
import QuickActions from './QuickActions';
import useConnectionStore from '../store/connectionStore';

export default function Sidebar() {
  const status = useConnectionStore((s) => s.status);
  // 'servers' | 'files' | 'actions'
  const [activeSection, setActiveSection] = useState('servers');

  const sections = [
    { id: 'servers', label: 'Servers' },
    { id: 'files', label: 'Files', disabled: status !== 'connected' },
    { id: 'actions', label: 'Actions', disabled: status !== 'connected' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0e0e1c] border-r border-gray-800/50">
      {/* Section tabs */}
      <div className="flex border-b border-gray-800/50">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => !section.disabled && setActiveSection(section.id)}
            disabled={section.disabled}
            className={`flex-1 py-2 text-xs font-medium transition-colors
              ${activeSection === section.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5'
                : section.disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
              }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'servers' && <ServerList />}
        {activeSection === 'files' && <FileExplorer />}
        {activeSection === 'actions' && <QuickActions />}
      </div>
    </div>
  );
}

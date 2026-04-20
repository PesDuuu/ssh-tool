import React, { useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { HiOutlineXMark } from 'react-icons/hi2';
import useFileStore from '../store/fileStore';
import useConnectionStore from '../store/connectionStore';
import useUIStore from '../store/uiStore';

export default function EditorPanel() {
  const tabs = useFileStore((s) => s.tabs);
  const activeTabIndex = useFileStore((s) => s.activeTabIndex);
  const setActiveTab = useFileStore((s) => s.setActiveTab);
  const closeTab = useFileStore((s) => s.closeTab);
  const updateTabContent = useFileStore((s) => s.updateTabContent);
  const saveFile = useFileStore((s) => s.saveFile);
  const savingPath = useFileStore((s) => s.savingPath);
  const sessionId = useConnectionStore((s) => s.activeSessionId);
  const addToast = useUIStore((s) => s.addToast);
  const editorRef = useRef(null);

  const activeTab = tabs[activeTabIndex] || null;

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Register Ctrl+S save keybinding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentIndex = useFileStore.getState().activeTabIndex;
      const currentTab = useFileStore.getState().tabs[currentIndex];
      if (currentTab?.isDirty) {
        const sid = useConnectionStore.getState().activeSessionId;
        saveFile(sid, currentIndex)
          .then(() => useUIStore.getState().addToast('File saved', 'success'))
          .catch((err) => useUIStore.getState().addToast(`Save failed: ${err.message}`, 'error'));
      }
    });

    // Set Monaco theme
    monaco.editor.defineTheme('ssh-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A7280' },
        { token: 'keyword', foreground: 'C792EA' },
        { token: 'string', foreground: 'C3E88D' },
        { token: 'number', foreground: 'F78C6C' },
        { token: 'type', foreground: 'FFCB6B' },
      ],
      colors: {
        'editor.background': '#0f0f1a',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#1a1a2e',
        'editor.selectionBackground': '#264F78',
        'editorCursor.foreground': '#60A5FA',
        'editorGutter.background': '#0f0f1a',
        'editorLineNumber.foreground': '#3a3a5c',
        'editorLineNumber.activeForeground': '#6A7280',
      },
    });
    monaco.editor.setTheme('ssh-dark');
  }, [saveFile]);

  const handleSave = async () => {
    if (!activeTab?.isDirty) return;
    try {
      await saveFile(sessionId, activeTabIndex);
      addToast('File saved', 'success');
    } catch (err) {
      addToast(`Save failed: ${err.message}`, 'error');
    }
  };

  const handleCloseTab = (e, index) => {
    e.stopPropagation();
    const tab = tabs[index];
    if (tab.isDirty && !confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return;
    closeTab(index);
  };

  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-500">No files open</p>
          <p className="text-xs text-gray-600">Double-click a file in the explorer to open it</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center bg-[#0d0d1a] border-b border-gray-800/50 overflow-x-auto">
        {tabs.map((tab, index) => (
          <div
            key={tab.path}
            onClick={() => setActiveTab(index)}
            className={`tab-item group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-gray-800/30 min-w-0 max-w-[180px]
              ${index === activeTabIndex ? 'active bg-[#0f0f1a] text-gray-200' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/20'}`}
          >
            {/* Dirty indicator */}
            {tab.isDirty && (
              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            )}
            <span className="text-xs truncate">{tab.name}</span>
            <button
              onClick={(e) => handleCloseTab(e, index)}
              className="tab-close p-0.5 hover:bg-gray-700 rounded ml-auto flex-shrink-0"
            >
              <HiOutlineXMark className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Save button */}
        {activeTab?.isDirty && (
          <button
            onClick={handleSave}
            disabled={!!savingPath}
            className="ml-auto mr-2 px-2 py-1 text-xs font-medium text-blue-400 hover:bg-blue-400/10 rounded transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {savingPath ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        {activeTab && (
          <Editor
            key={activeTab.path}
            language={activeTab.language}
            value={activeTab.content}
            onChange={(value) => updateTabContent(activeTabIndex, value || '')}
            onMount={handleEditorMount}
            theme="ssh-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              padding: { top: 8 },
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: 'always',
              wordWrap: 'on',
              tabSize: 2,
              automaticLayout: true,
            }}
          />
        )}
      </div>

      {/* Status bar */}
      {activeTab && (
        <div className="flex items-center justify-between px-3 py-1 bg-[#0d0d1a] border-t border-gray-800/50 text-xs text-gray-500">
          <span className="font-mono">{activeTab.path}</span>
          <div className="flex items-center gap-3">
            <span>{activeTab.language}</span>
            {activeTab.isDirty && <span className="text-blue-400">Modified</span>}
            {savingPath === activeTab.path && <span className="text-yellow-400">Saving...</span>}
          </div>
        </div>
      )}
    </div>
  );
}

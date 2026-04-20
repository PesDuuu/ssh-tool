import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  HiOutlineFolder, HiOutlineFolderOpen, HiOutlineDocument,
  HiOutlineArrowPath, HiOutlineChevronRight, HiOutlineChevronDown,
  HiOutlineArrowUpTray, HiOutlineDocumentPlus, HiOutlineFolderPlus
} from 'react-icons/hi2';
import useConnectionStore from '../store/connectionStore';
import useFileStore from '../store/fileStore';
import useUIStore from '../store/uiStore';

export default function FileExplorer() {
  const sessionId = useConnectionStore((s) => s.activeSessionId);
  const tree = useFileStore((s) => s.tree);
  const expandedPaths = useFileStore((s) => s.expandedPaths);
  const loadDirectory = useFileStore((s) => s.loadDirectory);
  const toggleExpand = useFileStore((s) => s.toggleExpand);
  const openFile = useFileStore((s) => s.openFile);
  const loadingPath = useFileStore((s) => s.loadingPath);
  const invalidateDirectory = useFileStore((s) => s.invalidateDirectory);
  const addToast = useUIStore((s) => s.addToast);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);

  // New file/folder inline creation state
  const [newItemTarget, setNewItemTarget] = useState(null); // { parentPath, type: 'file' | 'folder' }
  const [newItemName, setNewItemName] = useState('');
  const newItemInputRef = useRef(null);

  // Load root directory on mount
  useEffect(() => {
    if (sessionId && !tree['/']) {
      loadDirectory(sessionId, '/').catch((err) => addToast(err.message, 'error'));
    }
  }, [sessionId]);

  // Focus rename input when visible
  useEffect(() => {
    if (renameTarget && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameTarget]);

  // Focus new item input when visible
  useEffect(() => {
    if (newItemTarget && newItemInputRef.current) {
      newItemInputRef.current.focus();
    }
  }, [newItemTarget]);

  const handleToggle = useCallback(async (entry) => {
    if (!entry.isDirectory) return;
    toggleExpand(entry.path);

    // Lazy load if not yet loaded
    if (!tree[entry.path]?.loaded) {
      try {
        await loadDirectory(sessionId, entry.path);
      } catch (err) {
        addToast(`Failed to load ${entry.path}: ${err.message}`, 'error');
      }
    }
  }, [sessionId, tree, loadDirectory, toggleExpand, addToast]);

  const setMainView = useUIStore((s) => s.setMainView);

  const handleFileOpen = useCallback(async (entry) => {
    if (entry.isDirectory) return;
    try {
      await openFile(sessionId, entry.path, entry.name);
      // Auto-switch to editor view so the opened file is visible
      setMainView('editor');
    } catch (err) {
      addToast(`Failed to open ${entry.name}: ${err.message}`, 'error');
    }
  }, [sessionId, openFile, addToast, setMainView]);

  const handleContextMenu = useCallback((e, entry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleRename = async () => {
    if (!renameTarget || !renameValue || renameValue === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    try {
      const parentPath = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/')) || '/';
      const newPath = parentPath === '/' ? `/${renameValue}` : `${parentPath}/${renameValue}`;
      const result = await window.electronAPI.sftpRename(sessionId, renameTarget.path, newPath);
      if (!result.success) throw new Error(result.error);
      invalidateDirectory(parentPath);
      await loadDirectory(sessionId, parentPath);
      addToast('Renamed successfully', 'success');
    } catch (err) {
      addToast(`Rename failed: ${err.message}`, 'error');
    }
    setRenameTarget(null);
  };

  const handleDelete = async (entry) => {
    if (!confirm(`Delete "${entry.name}"?`)) return;
    try {
      const result = entry.isDirectory
        ? await window.electronAPI.sftpDeleteDir(sessionId, entry.path)
        : await window.electronAPI.sftpDelete(sessionId, entry.path);
      if (!result.success) throw new Error(result.error);
      const parentPath = entry.path.substring(0, entry.path.lastIndexOf('/')) || '/';
      invalidateDirectory(parentPath);
      await loadDirectory(sessionId, parentPath);
      addToast('Deleted successfully', 'success');
    } catch (err) {
      addToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleDownload = async (entry) => {
    try {
      const result = await window.electronAPI.sftpDownload(sessionId, entry.path);
      if (result.success) addToast(`Downloaded to ${result.path}`, 'success');
    } catch (err) {
      addToast(`Download failed: ${err.message}`, 'error');
    }
  };

  const handleUpload = async (targetPath) => {
    try {
      const result = await window.electronAPI.sftpUpload(sessionId, targetPath);
      if (result.success) {
        invalidateDirectory(targetPath);
        await loadDirectory(sessionId, targetPath);
        addToast(`Uploaded to ${result.path}`, 'success');
      }
    } catch (err) {
      addToast(`Upload failed: ${err.message}`, 'error');
    }
  };

  const handleRefresh = async () => {
    try {
      invalidateDirectory('/');
      await loadDirectory(sessionId, '/');
      addToast('Refreshed', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Start inline creation of a new file inside the given directory
  const startNewFile = (parentPath) => {
    // Expand the parent directory so the inline input is visible
    if (!expandedPaths.has(parentPath) && parentPath !== '/') {
      toggleExpand(parentPath);
      if (!tree[parentPath]?.loaded) {
        loadDirectory(sessionId, parentPath).catch(() => {});
      }
    }
    setNewItemTarget({ parentPath, type: 'file' });
    setNewItemName('');
  };

  // Start inline creation of a new folder inside the given directory
  const startNewFolder = (parentPath) => {
    if (!expandedPaths.has(parentPath) && parentPath !== '/') {
      toggleExpand(parentPath);
      if (!tree[parentPath]?.loaded) {
        loadDirectory(sessionId, parentPath).catch(() => {});
      }
    }
    setNewItemTarget({ parentPath, type: 'folder' });
    setNewItemName('');
  };

  // Confirm creation of the new file or folder
  const handleNewItemConfirm = async () => {
    if (!newItemTarget || !newItemName.trim()) {
      setNewItemTarget(null);
      return;
    }

    const parentPath = newItemTarget.parentPath;
    const fullPath = parentPath === '/' ? `/${newItemName.trim()}` : `${parentPath}/${newItemName.trim()}`;

    try {
      if (newItemTarget.type === 'folder') {
        const result = await window.electronAPI.sftpMkdir(sessionId, fullPath);
        if (!result.success) throw new Error(result.error);
        addToast(`Folder "${newItemName.trim()}" created`, 'success');
      } else {
        // Create an empty file via sftpWriteFile
        const result = await window.electronAPI.sftpWriteFile(sessionId, fullPath, '');
        if (!result.success) throw new Error(result.error);
        addToast(`File "${newItemName.trim()}" created`, 'success');
      }

      // Refresh the parent directory to show the new entry
      invalidateDirectory(parentPath);
      await loadDirectory(sessionId, parentPath);
    } catch (err) {
      addToast(`Create failed: ${err.message}`, 'error');
    }

    setNewItemTarget(null);
    setNewItemName('');
  };

  // Cancel new item creation
  const handleNewItemCancel = () => {
    setNewItemTarget(null);
    setNewItemName('');
  };

  // Renders the inline input row for creating a new file/folder
  const renderNewItemInput = (depth) => {
    if (!newItemTarget) return null;

    const isFolder = newItemTarget.type === 'folder';

    return (
      <div
        className="flex items-center gap-1 py-0.5 px-1 text-sm"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <span className="w-4" />
        {isFolder ? (
          <HiOutlineFolder className="w-4 h-4 text-blue-400 flex-shrink-0" />
        ) : (
          <HiOutlineDocument className="w-4 h-4 text-green-400 flex-shrink-0" />
        )}
        <input
          ref={newItemInputRef}
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onBlur={handleNewItemConfirm}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNewItemConfirm();
            if (e.key === 'Escape') handleNewItemCancel();
          }}
          placeholder={isFolder ? 'folder name...' : 'filename...'}
          className="flex-1 bg-[#0a0a14] border border-blue-500 rounded px-1 py-0 text-xs text-gray-200 focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  };

  const renderEntry = (entry, depth = 0) => {
    const isExpanded = expandedPaths.has(entry.path);
    const isLoading = loadingPath === entry.path;
    const isRenaming = renameTarget?.path === entry.path;
    // Check if the new item input belongs inside this directory
    const showNewItemHere = newItemTarget?.parentPath === entry.path && entry.isDirectory && isExpanded;

    return (
      <div key={entry.path}>
        <div
          className="flex items-center gap-1 py-0.5 px-1 hover:bg-gray-800/40 rounded cursor-pointer group text-sm"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => entry.isDirectory ? handleToggle(entry) : handleFileOpen(entry)}
          onDoubleClick={() => !entry.isDirectory && handleFileOpen(entry)}
          onContextMenu={(e) => handleContextMenu(e, entry)}
        >
          {/* Expand arrow for directories */}
          {entry.isDirectory ? (
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              {isLoading ? (
                <HiOutlineArrowPath className="w-3 h-3 text-gray-500 animate-spin" />
              ) : isExpanded ? (
                <HiOutlineChevronDown className="w-3 h-3 text-gray-500" />
              ) : (
                <HiOutlineChevronRight className="w-3 h-3 text-gray-500" />
              )}
            </span>
          ) : (
            <span className="w-4" />
          )}

          {/* Icon */}
          {entry.isDirectory ? (
            isExpanded ?
              <HiOutlineFolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" /> :
              <HiOutlineFolder className="w-4 h-4 text-blue-400 flex-shrink-0" />
          ) : (
            <HiOutlineDocument className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}

          {/* Name */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameTarget(null); }}
              className="flex-1 bg-[#0a0a14] border border-blue-500 rounded px-1 py-0 text-xs text-gray-200 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-xs text-gray-300">{entry.name}</span>
          )}
        </div>

        {/* Children */}
        {entry.isDirectory && isExpanded && (
          <>
            {/* New item input rendered at top of children if applicable */}
            {showNewItemHere && renderNewItemInput(depth + 1)}
            {tree[entry.path]?.entries?.map((child) => renderEntry(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  // Check if the new item input targets root level
  const showNewItemAtRoot = newItemTarget?.parentPath === '/';

  return (
    <div className="p-2" onClick={closeContextMenu}>
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Explorer</span>
        <div className="flex gap-1">
          <button onClick={() => startNewFile('/')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400" title="New file">
            <HiOutlineDocumentPlus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => startNewFolder('/')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400" title="New folder">
            <HiOutlineFolderPlus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleUpload('/')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400" title="Upload file">
            <HiOutlineArrowUpTray className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleRefresh} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400" title="Refresh">
            <HiOutlineArrowPath className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* File tree */}
      <div className="text-sm">
        {/* Root-level new item input */}
        {showNewItemAtRoot && renderNewItemInput(0)}
        {tree['/']?.entries?.map((entry) => renderEntry(entry, 0))}
        {!tree['/'] && (
          <div className="text-xs text-gray-500 text-center py-4">Loading...</div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#1e1e2e] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.entry.isDirectory && (
            <ContextMenuItem label="Open" onClick={() => { handleFileOpen(contextMenu.entry); closeContextMenu(); }} />
          )}
          {contextMenu.entry.isDirectory && (
            <>
              <ContextMenuItem label="New File" onClick={() => { startNewFile(contextMenu.entry.path); closeContextMenu(); }} />
              <ContextMenuItem label="New Folder" onClick={() => { startNewFolder(contextMenu.entry.path); closeContextMenu(); }} />
              <div className="border-t border-gray-700 my-1" />
            </>
          )}
          <ContextMenuItem label="Rename" onClick={() => {
            setRenameTarget(contextMenu.entry);
            setRenameValue(contextMenu.entry.name);
            closeContextMenu();
          }} />
          <ContextMenuItem label="Delete" danger onClick={() => { handleDelete(contextMenu.entry); closeContextMenu(); }} />
          <div className="border-t border-gray-700 my-1" />
          {!contextMenu.entry.isDirectory && (
            <ContextMenuItem label="Download" onClick={() => { handleDownload(contextMenu.entry); closeContextMenu(); }} />
          )}
          {contextMenu.entry.isDirectory && (
            <ContextMenuItem label="Upload here" onClick={() => { handleUpload(contextMenu.entry.path); closeContextMenu(); }} />
          )}
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({ label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700/50 transition-colors
        ${danger ? 'text-red-400 hover:text-red-300' : 'text-gray-300 hover:text-gray-100'}`}
    >
      {label}
    </button>
  );
}

import React from 'react';
import { HiPlus, HiOutlineServer, HiOutlinePencil, HiOutlineTrash, HiOutlineArrowRightOnRectangle, HiOutlineXMark } from 'react-icons/hi2';
import useConnectionStore from '../store/connectionStore';
import useFileStore from '../store/fileStore';
import useTerminalStore from '../store/terminalStore';
import useUIStore from '../store/uiStore';

export default function ServerList() {
  const connections = useConnectionStore((s) => s.connections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const status = useConnectionStore((s) => s.status);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const openConnectionDialog = useUIStore((s) => s.openConnectionDialog);
  const addToast = useUIStore((s) => s.addToast);
  const resetFiles = useFileStore((s) => s.reset);
  const resetTerminals = useTerminalStore((s) => s.reset);

  const handleConnect = async (conn) => {
    try {
      await connect(conn.id);
      addToast(`Connected to ${conn.label || conn.host}`, 'success');
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    }
  };

  const handleDisconnect = async () => {
    resetFiles();
    resetTerminals();
    await disconnect();
    addToast('Disconnected', 'info');
  };

  const handleDelete = async (e, conn) => {
    e.stopPropagation();
    if (confirm(`Delete connection "${conn.label || conn.host}"?`)) {
      await deleteConnection(conn.id);
      addToast('Connection deleted', 'info');
    }
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Connections</span>
        <button
          onClick={() => openConnectionDialog()}
          className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-blue-400"
          title="Add connection"
        >
          <HiPlus className="w-4 h-4" />
        </button>
      </div>

      {connections.length === 0 && (
        <div className="text-center py-8 px-4">
          <HiOutlineServer className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No saved connections</p>
          <button
            onClick={() => openConnectionDialog()}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Add your first server
          </button>
        </div>
      )}

      <div className="space-y-0.5">
        {connections.map((conn) => {
          const isActive = activeConnectionId === conn.id;
          const isConnecting = isActive && status === 'connecting';

          return (
            <div
              key={conn.id}
              className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors
                ${isActive ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-gray-800/50 border border-transparent'}`}
              onClick={() => !isActive && !isConnecting && handleConnect(conn)}
            >
              {/* Status indicator */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0
                ${isActive && status === 'connected' ? 'bg-emerald-500' :
                  isConnecting ? 'bg-yellow-500 animate-pulse' :
                  'bg-gray-600'}`}
              />

              {/* Connection info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 truncate">
                  {conn.label || conn.host}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {conn.username}@{conn.host}:{conn.port}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                {isActive ? (
                  <button onClick={(e) => { e.stopPropagation(); handleDisconnect(); }}
                          className="p-1 hover:bg-red-500/20 rounded text-red-400" title="Disconnect">
                    <HiOutlineXMark className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleConnect(conn); }}
                          className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400" title="Connect">
                    <HiOutlineArrowRightOnRectangle className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); openConnectionDialog(conn); }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400" title="Edit">
                  <HiOutlinePencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => handleDelete(e, conn)}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400" title="Delete">
                  <HiOutlineTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

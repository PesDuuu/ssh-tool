import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { HiOutlinePlus, HiOutlineXMark } from 'react-icons/hi2';
import useTerminalStore from '../store/terminalStore';
import useConnectionStore from '../store/connectionStore';
import useUIStore from '../store/uiStore';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPanel() {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeTerminalIndex = useTerminalStore((s) => s.activeTerminalIndex);
  const addTerminal = useTerminalStore((s) => s.addTerminal);
  const closeTerminal = useTerminalStore((s) => s.closeTerminal);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const sessionId = useConnectionStore((s) => s.activeSessionId);
  const addToast = useUIStore((s) => s.addToast);

  const handleNewTerminal = () => {
    if (!sessionId) return;
    addTerminal(sessionId);
  };

  const handleClose = (e, index) => {
    e.stopPropagation();
    closeTerminal(index);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Terminal tab bar */}
      <div className="flex items-center bg-[#0d0d1a] border-b border-gray-800/50">
        {terminals.map((term, index) => (
          <div
            key={term.id}
            onClick={() => setActiveTerminal(index)}
            className={`tab-item group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-gray-800/30
              ${index === activeTerminalIndex ? 'active bg-[#0f0f1a] text-gray-200' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/20'}`}
          >
            <span className="text-xs">{term.title}</span>
            <button onClick={(e) => handleClose(e, index)} className="tab-close p-0.5 hover:bg-gray-700 rounded">
              <HiOutlineXMark className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={handleNewTerminal}
                className="p-1.5 hover:bg-gray-800/50 text-gray-500 hover:text-gray-300 transition-colors" title="New terminal">
          <HiOutlinePlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden relative">
        {terminals.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-500">No terminals open</p>
              <button onClick={handleNewTerminal}
                      className="text-xs text-blue-400 hover:text-blue-300">
                Open a new terminal
              </button>
            </div>
          </div>
        ) : (
          terminals.map((term, index) => (
            <div key={term.id}
                 className={`absolute inset-0 ${index === activeTerminalIndex ? 'block' : 'hidden'}`}>
              <TerminalInstance termId={term.id} sessionId={term.sessionId} isActive={index === activeTerminalIndex} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Individual xterm.js terminal instance that connects to an SSH shell.
 */
function TerminalInstance({ termId, sessionId, isActive }) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const initializedRef = useRef(false);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      theme: {
        background: '#0a0a14',
        foreground: '#d4d4d4',
        cursor: '#60A5FA',
        selectionBackground: '#264F78',
        black: '#1e1e2e',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#94e2d5',
        white: '#cdd6f4',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#94e2d5',
        brightWhite: '#cdd6f4',
      },
      scrollback: 5000,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();

      // Open SSH shell with terminal dimensions
      const { cols, rows } = terminal;
      window.electronAPI.sshShellOpen(sessionId, termId, cols, rows).then((result) => {
        if (!result.success) {
          addToast(`Shell failed: ${result.error}`, 'error');
        }
      });
    }, 100);

    // Forward terminal input to SSH shell
    terminal.onData((data) => {
      window.electronAPI.sshShellWrite(termId, data);
    });

    // Listen for SSH shell output
    const removeListener = window.electronAPI.onShellData((incomingTermId, data) => {
      if (incomingTermId === termId && terminalRef.current) {
        terminalRef.current.write(data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = terminal;
        window.electronAPI.sshShellResize(termId, cols, rows);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      removeListener();
      terminal.dispose();
    };
  }, [termId, sessionId, addToast]);

  // Re-fit when tab becomes active
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current.fit();
        if (terminalRef.current) {
          const { cols, rows } = terminalRef.current;
          window.electronAPI.sshShellResize(termId, cols, rows);
          terminalRef.current.focus();
        }
      }, 50);
    }
  }, [isActive, termId]);

  return (
    <div ref={containerRef} className="xterm-container h-full w-full bg-[#0a0a14]" />
  );
}

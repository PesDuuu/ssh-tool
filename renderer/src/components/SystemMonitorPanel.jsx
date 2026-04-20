import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HiOutlineCpuChip,
  HiOutlineCircleStack,
  HiOutlineServerStack,
  HiOutlineSignal,
  HiOutlineClock,
  HiOutlineArrowPath,
  HiOutlinePause,
  HiOutlinePlay,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
} from 'react-icons/hi2';
import useConnectionStore from '../store/connectionStore';

// Combined shell command that collects all system stats in a single SSH exec call.
// Sections are delimited by marker lines for reliable parsing.
const STATS_COMMAND = [
  'echo "===UPTIME==="',
  'uptime',
  'echo "===LOADAVG==="',
  'cat /proc/loadavg 2>/dev/null || sysctl -n vm.loadavg 2>/dev/null || echo "N/A"',
  'echo "===CPU==="',
  // Grab idle% from top; works on most Linux distros
  'top -bn1 | head -5',
  'echo "===CPU_CORES==="',
  'nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "N/A"',
  'echo "===MEMORY==="',
  'free -b 2>/dev/null || vm_stat 2>/dev/null',
  'echo "===DISK==="',
  'df -h --output=source,size,used,avail,pcent,target 2>/dev/null || df -h',
  'echo "===NETWORK==="',
  'cat /proc/net/dev 2>/dev/null || netstat -ib 2>/dev/null',
  'echo "===PROCESSES==="',
  'ps aux --sort=-%cpu 2>/dev/null | head -11 || ps aux | head -11',
  'echo "===END==="',
].join(' && ');

// Available polling intervals in seconds
const INTERVAL_OPTIONS = [3, 5, 10, 15, 30, 60];

/**
 * Parses raw stdout into structured stat sections by splitting on marker lines.
 */
function parseSection(raw, sectionName) {
  const re = new RegExp(String.raw`===${sectionName}===\s*\n([\s\S]*?)(?=====[A-Z_]+===|$)`);
  const match = raw.match(re);
  return match ? match[1].trim() : '';
}

/**
 * Parses the CPU idle percentage from `top` output.
 * Looks for patterns like "XX.X id" or "XX.X%id".
 */
function parseCpu(section) {
  const idleMatch = section.match(/(\d+[.,]\d+)\s*%?\s*id/i);
  if (idleMatch) {
    const idle = Number.parseFloat(idleMatch[1].replace(',', '.'));
    return { usage: Math.max(0, Math.min(100, 100 - idle)), idle };
  }
  return null;
}

/**
 * Parses output of `free -b` into structured memory & swap data.
 */
function parseMemory(section) {
  const lines = section.split('\n');
  const memLine = lines.find((l) => /^Mem:/i.test(l));
  const swapLine = lines.find((l) => /^Swap:/i.test(l));

  const parseLine = (line) => {
    if (!line) return null;
    const parts = line.split(/\s+/).map(Number);
    // free -b output: label total used free shared buff/cache available
    return { total: parts[1] || 0, used: parts[2] || 0, free: parts[3] || 0, available: parts[6] || parts[3] || 0 };
  };

  return { mem: parseLine(memLine), swap: parseLine(swapLine) };
}

/**
 * Parses `df -h` output into an array of filesystem entries.
 */
function parseDisk(section) {
  const lines = section.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  // Skip header line
  return lines.slice(1).map((line) => {
    const parts = line.split(/\s+/);
    // Typical df output: Filesystem Size Used Avail Use% Mounted
    if (parts.length >= 6) {
      return {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        avail: parts[3],
        usePercent: Number.parseInt(parts[4], 10) || 0,
        mountedOn: parts.slice(5).join(' '),
      };
    }
    return null;
  }).filter(Boolean)
    // Filter out pseudo/tiny filesystems
    .filter((d) => !d.filesystem.startsWith('tmpfs') && !d.filesystem.startsWith('devtmpfs')
      && !d.filesystem.startsWith('udev') && !d.filesystem.startsWith('overlay')
      && d.filesystem !== 'none' && d.size !== '0');
}

/**
 * Parses /proc/net/dev into per-interface rx/tx bytes.
 */
function parseNetwork(section) {
  const lines = section.split('\n').filter((l) => l.includes(':'));
  return lines.map((line) => {
    const [iface, rest] = line.split(':');
    const nums = rest.trim().split(/\s+/).map(Number);
    return {
      name: iface.trim(),
      rxBytes: nums[0] || 0,
      txBytes: nums[8] || 0,
    };
  }).filter((n) => n.name !== 'lo'); // exclude loopback
}

/**
 * Parses `ps aux` top processes output.
 */
function parseProcesses(section) {
  const lines = section.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  // Skip header line (index 0)
  return lines.slice(1).map((line) => {
    const parts = line.split(/\s+/);
    // ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND...
    if (parts.length >= 11) {
      return {
        user: parts[0],
        pid: parts[1],
        cpu: Number.parseFloat(parts[2]) || 0,
        mem: Number.parseFloat(parts[3]) || 0,
        command: parts.slice(10).join(' '),
      };
    }
    return null;
  }).filter(Boolean);
}

/**
 * Formats byte values to human-readable strings.
 */
function formatBytes(bytes) {
  if (bytes === 0 || !bytes || Number.isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  return `${(bytes / Math.pow(1024, idx)).toFixed(1)} ${units[idx]}`;
}

/**
 * Returns a text color class based on value thresholds (high/medium/normal).
 */
function usageTextColor(value, highThreshold = 50, medThreshold = 20) {
  if (value > highThreshold) return 'text-red-400';
  if (value > medThreshold) return 'text-amber-400';
  return 'text-gray-300';
}

/**
 * Circular progress gauge rendered with SVG.
 */
function CircularGauge({ value, label, icon: Icon, color = 'blue', size = 100 }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.max(0, Math.min(100, value || 0));
  const offset = circumference - (clampedValue / 100) * circumference;

  const colorMap = {
    blue: { stroke: '#3b82f6', bg: 'rgba(59,130,246,0.1)', text: 'text-blue-400' },
    green: { stroke: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: 'text-green-400' },
    purple: { stroke: '#a855f7', bg: 'rgba(168,85,247,0.1)', text: 'text-purple-400' },
    amber: { stroke: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: 'text-amber-400' },
    red: { stroke: '#ef4444', bg: 'rgba(239,68,68,0.1)', text: 'text-red-400' },
    cyan: { stroke: '#06b6d4', bg: 'rgba(6,182,212,0.1)', text: 'text-cyan-400' },
  };

  // Escalate color to warn when usage is high
  let effectiveColor = color;
  if (clampedValue >= 90) effectiveColor = 'red';
  else if (clampedValue >= 75) effectiveColor = 'amber';
  const c = colorMap[effectiveColor] || colorMap.blue;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        {/* Progress arc */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={c.stroke} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }} />
      </svg>
      {/* Center label overlay */}
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        {Icon && <Icon className={`w-4 h-4 ${c.text} mb-0.5`} />}
        <span className={`text-lg font-bold ${c.text}`}>{clampedValue.toFixed(1)}%</span>
      </div>
      <span className="text-xs text-gray-400 mt-1">{label}</span>
    </div>
  );
}

/**
 * Horizontal usage bar for disk/swap entries.
 */
function UsageBar({ label, percent, used, total, color = 'blue' }) {
  const clampedPercent = Math.max(0, Math.min(100, percent || 0));
  let barColor = `bg-${color}-500`;
  if (clampedPercent >= 90) barColor = 'bg-red-500';
  else if (clampedPercent >= 75) barColor = 'bg-amber-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400 truncate mr-2">{label}</span>
        <span className="text-gray-500 shrink-0">{used} / {total} ({clampedPercent}%)</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clampedPercent}%` }} />
      </div>
    </div>
  );
}

/**
 * Stat card container with consistent styling.
 */
function StatCard({ title, icon: Icon, children, collapsible = false }) {
  const [collapsed, setCollapsed] = useState(false);

  const headerContent = (
    <>
      {Icon && <Icon className="w-4 h-4 text-gray-400" />}
      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</span>
      {collapsible && (
        <span className="ml-auto">
          {collapsed
            ? <HiOutlineChevronDown className="w-3.5 h-3.5 text-gray-500" />
            : <HiOutlineChevronUp className="w-3.5 h-3.5 text-gray-500" />}
        </span>
      )}
    </>
  );

  return (
    <div className="bg-[#0d0d1a] border border-gray-800/50 rounded-lg overflow-hidden">
      {collapsible ? (
        <button
          type="button"
          className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/30 cursor-pointer hover:bg-gray-800/20"
          onClick={() => setCollapsed(!collapsed)}
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/30">
          {headerContent}
        </div>
      )}
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}

export default function SystemMonitorPanel() {
  const execCommand = useConnectionStore((s) => s.execCommand);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [pollInterval, setPollInterval] = useState(5);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Track previous network reading for rate calculation
  const prevNetRef = useRef(null);
  const prevTimeRef = useRef(null);
  const [netRates, setNetRates] = useState([]);

  const timerRef = useRef(null);

  /**
   * Fetches all system stats in one SSH exec call, parses results,
   * and updates state.
   */
  const fetchStats = useCallback(async () => {
    try {
      const result = await execCommand(STATS_COMMAND);
      const raw = result.stdout || '';

      const cpu = parseCpu(parseSection(raw, 'CPU'));
      const memory = parseMemory(parseSection(raw, 'MEMORY'));
      const disks = parseDisk(parseSection(raw, 'DISK'));
      const network = parseNetwork(parseSection(raw, 'NETWORK'));
      const processes = parseProcesses(parseSection(raw, 'PROCESSES'));

      // Parse uptime string
      const uptimeRaw = parseSection(raw, 'UPTIME');

      // Parse load averages
      const loadRaw = parseSection(raw, 'LOADAVG');
      const loadParts = loadRaw.split(/\s+/);
      const loadAvg = {
        one: Number.parseFloat(loadParts[0]) || 0,
        five: Number.parseFloat(loadParts[1]) || 0,
        fifteen: Number.parseFloat(loadParts[2]) || 0,
      };

      // Parse CPU core count
      const coresRaw = parseSection(raw, 'CPU_CORES');
      const cpuCores = Number.parseInt(coresRaw, 10) || null;

      // Calculate network rates (bytes/sec) from delta between polls
      const now = Date.now();
      if (prevNetRef.current && prevTimeRef.current) {
        const elapsed = (now - prevTimeRef.current) / 1000;
        if (elapsed > 0) {
          const rates = network.map((iface) => {
            const prev = prevNetRef.current.find((p) => p.name === iface.name);
            if (!prev) return { name: iface.name, rxRate: 0, txRate: 0 };
            return {
              name: iface.name,
              rxRate: Math.max(0, (iface.rxBytes - prev.rxBytes) / elapsed),
              txRate: Math.max(0, (iface.txBytes - prev.txBytes) / elapsed),
            };
          });
          setNetRates(rates);
        }
      }
      prevNetRef.current = network;
      prevTimeRef.current = now;

      setStats({ cpu, memory, disks, network, processes, uptimeRaw, loadAvg, cpuCores });
      setLastUpdate(new Date());
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [execCommand]);

  // Set up polling interval
  useEffect(() => {
    // Fetch immediately on mount
    fetchStats();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restart timer whenever interval or pause state changes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!paused) {
      timerRef.current = setInterval(fetchStats, pollInterval * 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pollInterval, paused, fetchStats]);

  // Compute memory usage percentage
  const memPercent = stats?.memory?.mem
    ? ((stats.memory.mem.used / stats.memory.mem.total) * 100)
    : 0;

  // Compute swap usage percentage
  const swapPercent = stats?.memory?.swap && stats.memory.swap.total > 0
    ? ((stats.memory.swap.used / stats.memory.swap.total) * 100)
    : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50 bg-[#0a0a14]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Refresh: 
          </span>
          <select
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            className="bg-[#0d0d1a] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {INTERVAL_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>{sec}s</option>
            ))}
          </select>
          <button
            onClick={() => setPaused(!paused)}
            className={`p-1.5 rounded transition-colors ${paused ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'}`}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <HiOutlinePlay className="w-3.5 h-3.5" /> : <HiOutlinePause className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={fetchStats}
            className="p-1.5 rounded bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300 transition-colors"
            title="Refresh now"
          >
            <HiOutlineArrowPath className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-xs text-gray-600">
          {lastUpdate && `Last update: ${lastUpdate.toLocaleTimeString()}`}
          {paused && <span className="ml-2 text-amber-500">(Paused)</span>}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-800/30 text-xs text-red-400">
          Failed to fetch stats: {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !stats && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <HiOutlineArrowPath className="w-8 h-8 text-gray-600 animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Collecting system statistics...</p>
          </div>
        </div>
      )}

      {/* Dashboard content */}
      {stats && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Top gauges row: CPU + Memory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* CPU gauge card */}
            <StatCard title="CPU" icon={HiOutlineCpuChip}>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <CircularGauge
                    value={stats.cpu?.usage}
                    label="Usage"
                    icon={HiOutlineCpuChip}
                    color="blue"
                  />
                </div>
                <div className="flex-1 space-y-2 text-xs">
                  {stats.cpuCores && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cores</span>
                      <span className="text-gray-300">{stats.cpuCores}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Load (1m)</span>
                    <span className="text-gray-300">{stats.loadAvg.one.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Load (5m)</span>
                    <span className="text-gray-300">{stats.loadAvg.five.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Load (15m)</span>
                    <span className="text-gray-300">{stats.loadAvg.fifteen.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </StatCard>

            {/* Memory gauge card */}
            <StatCard title="Memory" icon={HiOutlineCircleStack}>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <CircularGauge
                    value={memPercent}
                    label="RAM"
                    icon={HiOutlineCircleStack}
                    color="purple"
                  />
                </div>
                <div className="flex-1 space-y-2 text-xs">
                  {stats.memory?.mem && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total</span>
                        <span className="text-gray-300">{formatBytes(stats.memory.mem.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Used</span>
                        <span className="text-gray-300">{formatBytes(stats.memory.mem.used)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Available</span>
                        <span className="text-gray-300">{formatBytes(stats.memory.mem.available)}</span>
                      </div>
                    </>
                  )}
                  {stats.memory?.swap && stats.memory.swap.total > 0 && (
                    <div className="pt-1 border-t border-gray-800/50">
                      <UsageBar
                        label="Swap"
                        percent={swapPercent}
                        used={formatBytes(stats.memory.swap.used)}
                        total={formatBytes(stats.memory.swap.total)}
                        color="purple"
                      />
                    </div>
                  )}
                </div>
              </div>
            </StatCard>
          </div>

          {/* Uptime */}
          {stats.uptimeRaw && (
            <StatCard title="Uptime" icon={HiOutlineClock}>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{stats.uptimeRaw}</pre>
            </StatCard>
          )}

          {/* Disk usage */}
          {stats.disks?.length > 0 && (
            <StatCard title="Disk Usage" icon={HiOutlineServerStack} collapsible>
              <div className="space-y-3">
                {stats.disks.map((disk, i) => (
                  <UsageBar
                    key={`${disk.filesystem}-${disk.mountedOn}`}
                    label={`${disk.mountedOn} (${disk.filesystem})`}
                    percent={disk.usePercent}
                    used={disk.used}
                    total={disk.size}
                    color="cyan"
                  />
                ))}
              </div>
            </StatCard>
          )}

          {/* Network */}
          {stats.network?.length > 0 && (
            <StatCard title="Network" icon={HiOutlineSignal} collapsible>
              <div className="space-y-3">
                {stats.network.map((iface) => {
                  const rate = netRates.find((r) => r.name === iface.name);
                  return (
                    <div key={iface.name} className="flex items-center gap-4 text-xs">
                      <span className="text-gray-400 font-mono w-16 shrink-0">{iface.name}</span>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-gray-500">RX: </span>
                          <span className="text-green-400">{formatBytes(iface.rxBytes)}</span>
                          {rate && (
                            <span className="text-gray-600 ml-1">({formatBytes(rate.rxRate)}/s)</span>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-500">TX: </span>
                          <span className="text-blue-400">{formatBytes(iface.txBytes)}</span>
                          {rate && (
                            <span className="text-gray-600 ml-1">({formatBytes(rate.txRate)}/s)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </StatCard>
          )}

          {/* Top processes */}
          {stats.processes?.length > 0 && (
            <StatCard title="Top Processes" icon={HiOutlineCpuChip} collapsible>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800/50">
                      <th className="text-left py-1.5 pr-3 font-medium">PID</th>
                      <th className="text-left py-1.5 pr-3 font-medium">User</th>
                      <th className="text-right py-1.5 pr-3 font-medium">CPU %</th>
                      <th className="text-right py-1.5 pr-3 font-medium">MEM %</th>
                      <th className="text-left py-1.5 font-medium">Command</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.processes.map((proc, i) => (
                      <tr key={`${proc.pid}-${i}`} className="border-b border-gray-800/20 hover:bg-gray-800/20">
                        <td className="py-1.5 pr-3 text-gray-400 font-mono">{proc.pid}</td>
                        <td className="py-1.5 pr-3 text-gray-400">{proc.user}</td>
                        <td className="py-1.5 pr-3 text-right">
                          <span className={usageTextColor(proc.cpu)}>
                            {proc.cpu.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          <span className={usageTextColor(proc.mem)}>
                            {proc.mem.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-1.5 text-gray-400 font-mono truncate max-w-xs" title={proc.command}>
                          {proc.command}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </StatCard>
          )}
        </div>
      )}
    </div>
  );
}

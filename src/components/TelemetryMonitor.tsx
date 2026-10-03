import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Cpu,
  HardDrive,
  Radio,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import { SystemStatus } from '../types/terminal';
import { TRANSLATIONS } from '../utils/persianDict';

interface TelemetryMonitorProps {
  lang: 'en' | 'fa';
}

export const TelemetryMonitor: React.FC<TelemetryMonitorProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [trafficRates, setTrafficRates] = useState<any[]>([]);
  const [isSampling, setIsSampling] = useState(false);
  const [trafficHistory, setTrafficHistory] = useState<{ rx: number; tx: number; time: string }[]>([]);

  const fetchStatus = async () => {
    try {
      const resp = await fetch('/api/system/status');
      const data: SystemStatus = await resp.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    }
  };

  const sampleTraffic = async (seconds: number = 2) => {
    setIsSampling(true);
    try {
      const resp = await fetch('/api/network/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      });
      const data = await resp.json();
      setTrafficRates(data.rates || []);

      if (data.rates && data.rates[0]) {
        setTrafficHistory((prev) => [
          ...prev.slice(-14),
          {
            rx: Math.round(data.rates[0].rxBps / 1024),
            tx: Math.round(data.rates[0].txBps / 1024),
            time: new Date().toLocaleTimeString().slice(3, 8),
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to sample traffic:', err);
    } finally {
      setIsSampling(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    sampleTraffic(1);
    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <span>{lang === 'fa' ? 'پایش زنده ترافیک و سخت‌افزار' : 'Live Host Telemetry & Traffic'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                Linux Kernel
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Host: {status?.hostname || 'localhost'} ({status?.osName || 'Linux'}) | Arch: {status?.arch || 'x64'}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchStatus();
            sampleTraffic(2);
          }}
          disabled={isSampling}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isSampling ? 'animate-spin' : ''}`} />
          <span>{isSampling ? 'Sampling...' : 'Sample Network (2s)'}</span>
        </button>
      </div>

      {/* Network Traffic Rates Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono uppercase text-zinc-300 font-semibold tracking-wider">
              {lang === 'fa' ? 'نرخ داده‌های شبکه (RX / TX)' : 'Interface Bandwidth Rates'}
            </h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Kernel `/proc/net/dev` Counters
          </span>
        </div>

        {/* Interface rate badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {trafficRates.map((rate) => (
            <div
              key={rate.interface}
              className="bg-zinc-950 border border-zinc-800 rounded-lg p-3.5 flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-mono font-bold text-zinc-200">{rate.interface}</span>
                <span className="text-[10px] text-zinc-500 block">NIC Device</span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <span className="text-emerald-400 font-mono text-xs font-semibold flex items-center gap-0.5 justify-end">
                    <ArrowDown className="w-3 h-3" />
                    {rate.rxHuman}
                  </span>
                  <span className="text-[10px] text-zinc-500">Download (RX)</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-mono text-xs font-semibold flex items-center gap-0.5 justify-end">
                    <ArrowUp className="w-3 h-3" />
                    {rate.txHuman}
                  </span>
                  <span className="text-[10px] text-zinc-500">Upload (TX)</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Throughput Waterfall bars */}
        {trafficHistory.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3 space-y-2">
            <span className="text-[11px] text-zinc-400 font-mono">Sample History (KB/s):</span>
            <div className="flex items-end gap-1.5 h-20 pt-2 px-1">
              {trafficHistory.map((h, i) => {
                const maxVal = Math.max(...trafficHistory.map((m) => Math.max(m.rx, m.tx)), 30);
                const rxHeight = Math.max(Math.round((h.rx / maxVal) * 100), 10);
                const txHeight = Math.max(Math.round((h.tx / maxVal) * 100), 10);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5 group">
                    <div className="w-full flex gap-0.5 items-end h-full">
                      <div
                        style={{ height: `${rxHeight}%` }}
                        className="flex-1 bg-emerald-500/70 group-hover:bg-emerald-400 rounded-t transition-all"
                        title={`RX: ${h.rx} KB/s (${h.time})`}
                      />
                      <div
                        style={{ height: `${txHeight}%` }}
                        className="flex-1 bg-cyan-500/70 group-hover:bg-cyan-400 rounded-t transition-all"
                        title={`TX: ${h.tx} KB/s (${h.time})`}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-zinc-600 mt-1">{h.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Hardware Utilization Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CPU Load */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-300">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold">{lang === 'fa' ? 'بار پردازنده (CPU)' : 'CPU Load Averages'}</h4>
            </div>
            <span className="text-xs font-mono text-zinc-400">{status?.cpuCores || 2} Cores</span>
          </div>
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">1 min avg:</span>
              <span className="text-emerald-400 font-bold">{status?.cpuLoad[0]?.toFixed(2) || '0.12'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">5 min avg:</span>
              <span className="text-zinc-300">{status?.cpuLoad[1]?.toFixed(2) || '0.15'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">15 min avg:</span>
              <span className="text-zinc-400">{status?.cpuLoad[2]?.toFixed(2) || '0.10'}</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono truncate">{status?.cpuModel}</p>
        </div>

        {/* Memory Allocation */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-300">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold">{lang === 'fa' ? 'حافظه اصلی (RAM)' : 'Memory Distribution'}</h4>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold">
              {status?.memory.usagePercent}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${status?.memory.usagePercent || 40}%` }}
                className="h-full bg-cyan-500 transition-all duration-500 rounded-full"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Used: {formatBytes(status?.memory.usedBytes || 0)}</span>
              <span>Total: {formatBytes(status?.memory.totalBytes || 0)}</span>
            </div>
          </div>

          <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 text-[11px] font-mono text-zinc-400 flex justify-between">
            <span>Free buffer:</span>
            <span className="text-emerald-400">{formatBytes(status?.memory.freeBytes || 0)}</span>
          </div>
        </div>

        {/* Disk Capacity */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-300">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold">{lang === 'fa' ? 'حجم دیسک (Storage)' : 'Filesystem Capacity'}</h4>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold">
              {status?.disk.usagePercent}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${status?.disk.usagePercent || 25}%` }}
                className="h-full bg-amber-500 transition-all duration-500 rounded-full"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Used: {formatBytes(status?.disk.usedBytes || 0)}</span>
              <span>Total: {formatBytes(status?.disk.totalBytes || 0)}</span>
            </div>
          </div>

          <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 text-[11px] font-mono text-zinc-400 flex justify-between">
            <span>Mount point:</span>
            <span className="text-zinc-200">{status?.disk.mountPoint || '/'}</span>
          </div>
        </div>
      </div>

      {/* Listening Sockets (Open Ports) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase text-zinc-300 font-semibold tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'fa' ? 'پورت‌ها و سوکت‌های فعال شبکه (Active Listeners)' : 'Active Listening Sockets'}</span>
          </h4>
          <span className="text-[11px] font-mono text-zinc-500">ss -tulpn format</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-[11px]">
                <th className="pb-2">Proto</th>
                <th className="pb-2">Local Address</th>
                <th className="pb-2">Port</th>
                <th className="pb-2">Process / Service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {status?.openPorts.map((p, idx) => (
                <tr key={idx} className="hover:bg-zinc-950/40">
                  <td className="py-2 text-zinc-400 uppercase font-semibold">{p.proto}</td>
                  <td className="py-2 text-zinc-300">{p.localAddress}</td>
                  <td className="py-2 text-emerald-400 font-bold">{p.port}</td>
                  <td className="py-2 text-cyan-300">{p.process || 'listening'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

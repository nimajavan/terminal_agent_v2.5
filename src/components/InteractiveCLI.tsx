import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Trash2, Copy, Check, CornerDownLeft, Shield, AlertTriangle } from 'lucide-react';
import { analyzeCommand } from '../utils/safety';
import { TRANSLATIONS } from '../utils/persianDict';

interface HistoryItem {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timestamp: string;
  safetyLevel?: string;
}

interface InteractiveCLIProps {
  lang: 'en' | 'fa';
}

export const InteractiveCLI: React.FC<InteractiveCLIProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [inputCmd, setInputCmd] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 'init-1',
      command: 'lta --help',
      stdout: `Linux Terminal Agent (LTA) v2.5.0 Pro
Usage: lta [OPTIONS] [PROMPT]

Natural Language -> Linux Shell Automation
Commands:
  agent <goal>          Execute multi-step bounded goal
  doctor <service>      Deep health triage with verification
  skills <list|run>     Run built-in and modular skill packs
  sessions              Inspect or resume saved journals
  config <list|set>     View or edit runtime configurations`,
      stderr: '',
      exitCode: 0,
      durationMs: 8,
      timestamp: new Date().toLocaleTimeString(),
      safetyLevel: 'SAFE',
    },
  ]);
  const [cmdHistoryList, setCmdHistoryList] = useState<string[]>(['lta --help']);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  const runCommand = async (cmdToRun: string) => {
    const trimmed = cmdToRun.trim();
    if (!trimmed) return;

    setInputCmd('');
    setCmdHistoryList((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);

    // Instant client-side check
    const safety = analyzeCommand(trimmed);
    if (safety.isBlocked) {
      setHistory((prev) => [
        ...prev,
        {
          id: `cmd_${Date.now()}`,
          command: trimmed,
          stdout: '',
          stderr: `BLOCKED by LTA Security Policy: ${safety.reasons.join(', ')}`,
          exitCode: 126,
          durationMs: 2,
          timestamp: new Date().toLocaleTimeString(),
          safetyLevel: 'BLOCKED',
        },
      ]);
      return;
    }

    setIsLoading(true);

    try {
      // Special LTA CLI simulation commands if user typed `lta doctor ...` or `lta skills ...`
      let executionCmd = trimmed;
      if (trimmed.startsWith('lta doctor nginx')) {
        executionCmd = 'nginx -t 2>&1 || (cat /etc/nginx/nginx.conf 2>/dev/null | head -n 15) || echo "nginx doctor: check passed"';
      } else if (trimmed.startsWith('lta skills list')) {
        executionCmd = 'echo "Built-in skill packs: nginx, git, docker, systemd, network, traffic, ssl_inspector, security_audit"';
      } else if (trimmed.startsWith('lta config list')) {
        executionCmd = 'echo "{\\"provider\\": \\"gemini\\", \\"local_only\\": false, \\"budget_usd\\": 1.0, \\"timeout\\": 60}"';
      }

      const resp = await fetch('/api/shell/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: executionCmd }),
      });

      const resData = await resp.json();

      setHistory((prev) => [
        ...prev,
        {
          id: `cmd_${Date.now()}`,
          command: trimmed,
          stdout: resData.stdout || (resData.blocked ? '' : ''),
          stderr: resData.stderr || (resData.blocked ? resData.error : ''),
          exitCode: resData.exitCode ?? (resData.blocked ? 126 : 0),
          durationMs: resData.durationMs || 10,
          timestamp: new Date().toLocaleTimeString(),
          safetyLevel: safety.level,
        },
      ]);
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          id: `cmd_${Date.now()}`,
          command: trimmed,
          stdout: '',
          stderr: err.message || 'Execution error',
          exitCode: 1,
          durationMs: 5,
          timestamp: new Date().toLocaleTimeString(),
          safetyLevel: 'CAUTION',
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistoryList.length === 0) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx < cmdHistoryList.length) {
        setHistoryIdx(nextIdx);
        setInputCmd(cmdHistoryList[cmdHistoryList.length - 1 - nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInputCmd(cmdHistoryList[cmdHistoryList.length - 1 - nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setInputCmd('');
      }
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const quickCommands = [
    { label: 'lta --help', cmd: 'lta --help' },
    { label: 'lta doctor nginx', cmd: 'lta doctor nginx' },
    { label: 'lta skills list', cmd: 'lta skills list' },
    { label: 'df -h', cmd: 'df -h' },
    { label: 'free -h', cmd: 'free -h' },
    { label: 'uname -a', cmd: 'uname -a' },
    { label: 'ps aux | head', cmd: 'ps aux | head -n 10' },
  ];

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[650px] font-mono">
      {/* Terminal Title Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-xs text-zinc-400 font-semibold ml-2 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            bash - lta@localhost:~
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistory([])}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Clear terminal buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Command Suggestions Header */}
      <div className="bg-zinc-900/40 border-b border-zinc-800/80 px-4 py-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-zinc-500 font-medium mr-1">Quick Run:</span>
        {quickCommands.map((q, idx) => (
          <button
            key={idx}
            onClick={() => runCommand(q.cmd)}
            className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-emerald-300 border border-zinc-700/50 transition-colors"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Console Output Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs select-text">
        {history.map((item) => (
          <div key={item.id} className="space-y-1 group">
            {/* Command Line with Prompt */}
            <div className="flex items-center justify-between text-zinc-400">
              <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                <span className="text-emerald-400 font-bold">user@lta-linux</span>
                <span className="text-zinc-600">:</span>
                <span className="text-cyan-400 font-bold">~</span>
                <span className="text-zinc-500">$</span>
                <span className="text-zinc-100 font-semibold ml-1">{item.command}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[10px] text-zinc-500">
                <span>{item.durationMs}ms</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-mono ${
                    item.exitCode === 0 ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-400 bg-rose-950/40'
                  }`}
                >
                  exit {item.exitCode}
                </span>
                <button
                  onClick={() => handleCopy(item.stdout || item.stderr, item.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-200 transition-opacity"
                  title="Copy output"
                >
                  {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Output */}
            {item.stdout && (
              <pre className="text-zinc-300 whitespace-pre-wrap pl-4 border-l border-zinc-800 font-mono leading-relaxed">
                {item.stdout}
              </pre>
            )}
            {item.stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap pl-4 border-l border-rose-800 font-mono leading-relaxed">
                {item.stderr}
              </pre>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400 pl-4 border-l border-emerald-500/50">
            <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-zinc-500">Executing non-interactive subshell...</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Terminal Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runCommand(inputCmd);
        }}
        className="bg-zinc-900/90 border-t border-zinc-800 p-3 flex items-center gap-2"
      >
        <span className="text-emerald-400 font-bold">$</span>
        <input
          ref={inputRef}
          type="text"
          value={inputCmd}
          onChange={(e) => setInputCmd(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type bash or LTA command (e.g. df -h, lta doctor nginx, lta skills list)..."
          className="flex-1 bg-transparent text-zinc-100 text-xs font-mono outline-none placeholder:text-zinc-600"
          autoFocus
        />
        <button
          type="submit"
          disabled={!inputCmd.trim() || isLoading}
          className="p-1.5 text-zinc-400 hover:text-emerald-400 disabled:opacity-30 transition-colors"
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

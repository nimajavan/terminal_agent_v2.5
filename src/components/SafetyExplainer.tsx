import React, { useState } from 'react';
import {
  Shield,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Code2,
  Terminal,
} from 'lucide-react';
import { DangerLevel, CommandExploration } from '../types/terminal';
import { TRANSLATIONS } from '../utils/persianDict';

interface SafetyExplainerProps {
  lang: 'en' | 'fa';
}

export const SafetyExplainer: React.FC<SafetyExplainerProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [command, setCommand] = useState('find /var/log -type f -mtime +30 | xargs rm -f');
  const [analysis, setAnalysis] = useState<CommandExploration | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async (cmdToAnalyze?: string) => {
    const target = cmdToAnalyze || command;
    if (!target.trim()) return;

    setIsLoading(true);
    try {
      const resp = await fetch('/api/agent/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: target }),
      });
      const data = await resp.json();
      setAnalysis(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleCommands = [
    { label: 'find ... | xargs rm', cmd: 'find /var/log -type f -mtime +30 | xargs rm -f' },
    { label: 'iptables -F', cmd: 'iptables -F' },
    { label: 'systemctl restart nginx', cmd: 'systemctl restart nginx' },
    { label: 'curl ... | bash', cmd: 'curl -fsSL https://get.docker.com | bash' },
    { label: 'rm -rf /', cmd: 'rm -rf / --no-preserve-root' },
    { label: 'ps aux | grep node', cmd: 'ps aux | grep node | awk \'{print $2}\'' },
  ];

  const getBadge = (lvl: DangerLevel) => {
    switch (lvl) {
      case 'SAFE':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            SAFE (Read-Only / Bounded)
          </span>
        );
      case 'CAUTION':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            CAUTION (Requires Review)
          </span>
        );
      case 'DANGEROUS':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            DANGEROUS (High System Impact)
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-red-950 text-red-400 border border-red-800 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            BLOCKED BY LTA POLICY
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>{lang === 'fa' ? 'تشریح امنیتی دستورات خط فرمان' : 'Command Security & Syntax Explainer'}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                LTA Safety Engine
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {lang === 'fa'
                ? 'تحلیل عمیق سینتکس، پرچم‌ها، عملگرهای پایپ و ارزیابی ریسک تخریب قبل از اجرا'
                : 'Deconstruct bash pipelines flag-by-flag, detect destructive patterns, and get safe alternatives.'}
            </p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1 font-mono">
            <span className="absolute left-3 top-3 text-emerald-400 font-bold">$</span>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Paste any bash command or pipeline..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-4 py-2.5 text-xs text-zinc-200 outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !command.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold rounded-lg text-xs transition-colors shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>{lang === 'fa' ? 'تحلیل دستور' : 'Analyze Command'}</span>
          </button>
        </form>

        {/* Sample Command Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-zinc-500 text-[11px]">Samples:</span>
          {sampleCommands.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCommand(s.cmd);
                handleAnalyze(s.cmd);
              }}
              className="px-2.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700/60"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Output */}
      {analysis && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
          {/* Danger Level & Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                {getBadge(analysis.dangerLevel)}
                <span className="text-xs font-mono text-zinc-400">
                  {analysis.posixCompliant ? 'POSIX Compliant' : 'Non-Standard Shell'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                {lang === 'fa' ? analysis.summaryFa : analysis.summary}
              </p>
            </div>
          </div>

          {/* Warnings List if any */}
          {analysis.warnings.length > 0 && (
            <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                {lang === 'fa' ? 'شدت خطر و موارد قابل توجه:' : 'Security Policy Warnings:'}
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-300/90 text-[11px]">
                {analysis.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
              {analysis.safeAlternative && (
                <div className="mt-2 pt-2 border-t border-amber-800/40 text-emerald-300 font-mono text-[11px]">
                  💡 Recommended Safe Alternative: {analysis.safeAlternative}
                </div>
              )}
            </div>
          )}

          {/* Token-by-Token Decomposition */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'fa' ? 'کالبدشکافی ساختار و پرچم‌های دستور' : 'Flag & Token Breakdown'}</span>
            </h4>

            <div className="space-y-2">
              {analysis.tokens.map((tok, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        tok.type === 'binary'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : tok.type === 'flag'
                          ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                          : tok.type === 'pipe'
                          ? 'bg-purple-950 text-purple-400 border border-purple-800'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {tok.token}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                      {tok.type}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs font-sans sm:text-right">
                    {lang === 'fa' ? tok.descriptionFa : tok.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

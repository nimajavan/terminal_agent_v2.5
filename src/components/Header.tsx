import React from 'react';
import { Terminal, Shield, Zap, Cpu, DollarSign, Globe, Lock, ExternalLink } from 'lucide-react';
import { TRANSLATIONS } from '../utils/persianDict';
import { UsageBudget } from '../types/terminal';

interface HeaderProps {
  lang: 'en' | 'fa';
  setLang: (lang: 'en' | 'fa') => void;
  provider: string;
  setProvider: (p: string) => void;
  localOnly: boolean;
  setLocalOnly: (val: boolean) => void;
  routeSimple: boolean;
  setRouteSimple: (val: boolean) => void;
  budget: UsageBudget;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  provider,
  setProvider,
  localOnly,
  setLocalOnly,
  routeSimple,
  setRouteSimple,
  budget,
}) => {
  const t = TRANSLATIONS[lang];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-50 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10">
            <Terminal className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
                {t.appTitle}
                <span className="text-xs px-1.5 py-0.5 font-mono font-semibold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  v2.5 Pro
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">{t.tagline}</p>
          </div>
        </div>

        {/* Status Badges & Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Local / Online Indicator */}
          <button
            onClick={() => setLocalOnly(!localOnly)}
            title={localOnly ? 'Click to enable Cloud Providers' : 'Click to enforce Local-Only'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium transition-colors ${
              localOnly
                ? 'bg-amber-950/40 border-amber-600/40 text-amber-300 hover:bg-amber-900/50'
                : 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/50'
            }`}
          >
            {localOnly ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Globe className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{localOnly ? t.localOnly : t.online}</span>
          </button>

          {/* Route Simple Toggle */}
          <button
            onClick={() => setRouteSimple(!routeSimple)}
            title="Fast offline rule-based planner for common requests"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium transition-colors ${
              routeSimple
                ? 'bg-cyan-950/40 border-cyan-600/40 text-cyan-300 hover:bg-cyan-900/50'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.routeSimple}</span>
          </button>

          {/* Provider Selection */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1">
            <Cpu className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="bg-transparent text-zinc-200 outline-none cursor-pointer text-xs font-mono"
            >
              <option value="gemini" className="bg-zinc-900 text-zinc-100">
                Gemini 3.8 Flash
              </option>
              <option value="rule_based" className="bg-zinc-900 text-zinc-100">
                Rule-Based (Offline)
              </option>
              <option value="ollama" className="bg-zinc-900 text-zinc-100">
                Ollama (Local)
              </option>
            </select>
          </div>

          {/* Budget / Usage Meter */}
          <div className="hidden md:flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/80 rounded-md px-2.5 py-1 font-mono text-zinc-300">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              ${budget.estimatedCostUsd.toFixed(4)} / ${budget.budgetLimitUsd.toFixed(2)}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">{budget.totalInputTokens + budget.totalOutputTokens} tok</span>
          </div>

          {/* Language Toggle (EN / FA فارسی) */}
          <button
            onClick={() => setLang(lang === 'en' ? 'fa' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold transition-colors"
          >
            <span>{lang === 'en' ? '🇮🇷 فارسی' : '🇬🇧 English'}</span>
          </button>

          {/* GitHub Link */}
          <a
            href="https://github.com/nimajavan/terminal_agent"
            target="_blank"
            rel="noreferrer"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="nimajavan/terminal_agent on GitHub"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};

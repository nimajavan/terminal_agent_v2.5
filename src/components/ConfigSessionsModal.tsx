import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Sliders, Shield, Database, X } from 'lucide-react';
import { UsageBudget, LTAPlan } from '../types/terminal';
import { TRANSLATIONS } from '../utils/persianDict';

interface ConfigSessionsModalProps {
  lang: 'en' | 'fa';
  isOpen: boolean;
  onClose: () => void;
  budget: UsageBudget;
  setBudget: React.Dispatch<React.SetStateAction<UsageBudget>>;
  localOnly: boolean;
  setLocalOnly: (val: boolean) => void;
  routeSimple: boolean;
  setRouteSimple: (val: boolean) => void;
  currentPlan: LTAPlan | null;
  onReplan: () => void;
}

export const ConfigSessionsModal: React.FC<ConfigSessionsModalProps> = ({
  lang,
  isOpen,
  onClose,
  budget,
  setBudget,
  localOnly,
  setLocalOnly,
  routeSimple,
  setRouteSimple,
  currentPlan,
  onReplan,
}) => {
  const t = TRANSLATIONS[lang];
  const [budgetInput, setBudgetInput] = useState(budget.budgetLimitUsd.toString());
  const [timeoutSec, setTimeoutSec] = useState('60');
  const [maxSteps, setMaxSteps] = useState('12');

  if (!isOpen) return null;

  const handleSave = () => {
    const newLimit = parseFloat(budgetInput) || 1.0;
    setBudget((prev) => ({ ...prev, budgetLimitUsd: newLimit }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-zinc-100">
              {lang === 'fa' ? 'پیکربندی و مدیریت نشست‌های LTA' : 'LTA Configuration & Session Settings'}
            </h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Form */}
        <div className="space-y-4 text-xs">
          {/* Budget Limit USD */}
          <div className="space-y-1">
            <label className="font-semibold text-zinc-200">
              {lang === 'fa' ? 'سقف بودجه مصرف مدل (USD)' : 'Model Usage Budget Limit (USD)'}
            </label>
            <div className="relative font-mono">
              <span className="absolute left-3 top-2.5 text-zinc-500">$</span>
              <input
                type="number"
                step="0.05"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-7 pr-3 py-2 text-zinc-200 outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              LTA halts planning calls before exceeding this budget threshold.
            </p>
          </div>

          {/* Max Steps per Plan */}
          <div className="space-y-1">
            <label className="font-semibold text-zinc-200">Max Steps per Plan</label>
            <input
              type="number"
              value={maxSteps}
              onChange={(e) => setMaxSteps(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-zinc-500">
              Bounds plan complexity to prevent runaway loops (default 12).
            </p>
          </div>

          {/* Subshell Timeout */}
          <div className="space-y-1">
            <label className="font-semibold text-zinc-200">Command Execution Timeout (Seconds)</label>
            <input
              type="number"
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-zinc-500">
              Kills process group if execution exceeds this threshold (default 60s).
            </p>
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <label className="flex items-center justify-between cursor-pointer p-2 bg-zinc-950 rounded-lg border border-zinc-800">
              <div>
                <span className="font-semibold text-zinc-200 block">Enforce Local-Only Mode</span>
                <span className="text-[11px] text-zinc-500">Strictly forbid cloud model traffic</span>
              </div>
              <input
                type="checkbox"
                checked={localOnly}
                onChange={(e) => setLocalOnly(e.target.checked)}
                className="rounded border-zinc-700 text-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-2 bg-zinc-950 rounded-lg border border-zinc-800">
              <div>
                <span className="font-semibold text-zinc-200 block">Route Simple Queries (Rule-Based)</span>
                <span className="text-[11px] text-zinc-500">Use instant offline rules for exact inspection requests</span>
              </div>
              <input
                type="checkbox"
                checked={routeSimple}
                onChange={(e) => setRouteSimple(e.target.checked)}
                className="rounded border-zinc-700 text-cyan-500"
              />
            </label>
          </div>

          {/* Session Recovery action if plan exists */}
          {currentPlan && (
            <div className="pt-2 border-t border-zinc-800">
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-mono text-zinc-300 font-bold block">lta resume --replan</span>
                  <span className="text-[11px] text-zinc-500">
                    Generate new plan based on current execution evidence
                  </span>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onReplan();
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold rounded text-xs transition-colors"
                >
                  Replan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold rounded-lg text-xs transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

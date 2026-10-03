import React, { useState } from 'react';
import {
  Send,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Terminal as TerminalIcon,
  Sparkles,
  ArrowRight,
  Loader2,
  FileCode,
  Check,
  AlertCircle,
  Eye,
  Activity,
  Layers,
} from 'lucide-react';
import { LTAPlan, PlanStep, DangerLevel, UsageBudget } from '../types/terminal';
import { TRANSLATIONS } from '../utils/persianDict';

interface TerminalPlannerProps {
  lang: 'en' | 'fa';
  provider: string;
  localOnly: boolean;
  routeSimple: boolean;
  onPlanGenerated: (plan: LTAPlan) => void;
  currentPlan: LTAPlan | null;
  setCurrentPlan: React.Dispatch<React.SetStateAction<LTAPlan | null>>;
  onExecutePlan: (plan: LTAPlan, dryRun?: boolean) => Promise<void>;
  isExecuting: boolean;
  budget: UsageBudget;
  setBudget: React.Dispatch<React.SetStateAction<UsageBudget>>;
}

export const TerminalPlanner: React.FC<TerminalPlannerProps> = ({
  lang,
  provider,
  localOnly,
  routeSimple,
  onPlanGenerated,
  currentPlan,
  setCurrentPlan,
  onExecutePlan,
  isExecuting,
  budget,
  setBudget,
}) => {
  const t = TRANSLATIONS[lang];
  const [prompt, setPrompt] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [stepByStepIndex, setStepByStepIndex] = useState<number>(0);
  const [confirmDangerousModal, setConfirmDangerousModal] = useState<boolean>(false);

  const handleGeneratePlan = async (queryText?: string) => {
    const textToPlan = queryText || prompt;
    if (!textToPlan.trim()) return;

    setIsPlanning(true);
    setErrorMsg(null);

    try {
      const resp = await fetch('/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToPlan,
          provider,
          localOnly,
          routeSimple,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Failed to generate plan');
      }

      const data = await resp.json();
      const plan: LTAPlan = data.plan;

      // Update budget
      if (data.tokens) {
        setBudget((prev) => {
          const cost = (data.tokens.input * 0.15 + data.tokens.output * 0.6) / 1_000_000;
          return {
            ...prev,
            totalInputTokens: prev.totalInputTokens + (data.tokens.input || 0),
            totalOutputTokens: prev.totalOutputTokens + (data.tokens.output || 0),
            totalCalls: prev.totalCalls + 1,
            estimatedCostUsd: prev.estimatedCostUsd + cost,
            lastLatencyMs: data.latencyMs || 0,
          };
        });
      }

      setCurrentPlan(plan);
      onPlanGenerated(plan);

      // Expand all steps by default
      const initialExpand: Record<string, boolean> = {};
      plan.steps.forEach((s) => {
        initialExpand[s.id] = true;
      });
      setExpandedSteps(initialExpand);
      setStepByStepIndex(0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while contacting planning agent.');
    } finally {
      setIsPlanning(false);
    }
  };

  const toggleStepExpand = (id: string) => {
    setExpandedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyCommand = (text: string, stepId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStepId(stepId);
    setTimeout(() => setCopiedStepId(null), 2000);
  };

  const handleExportPlanJson = () => {
    if (!currentPlan) return;
    const blob = new Blob([JSON.stringify(currentPlan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lta-plan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLtaCli = () => {
    if (!currentPlan) return;
    const cliCmd = `lta --agent -p ${provider} "${currentPlan.goal.replace(/"/g, '\\"')}"`;
    navigator.clipboard.writeText(cliCmd);
    setCopiedStepId('cli');
    setTimeout(() => setCopiedStepId(null), 2000);
  };

  // Check if plan has Dangerous or Blocked steps
  const hasDangerousSteps = currentPlan?.steps.some(
    (s) => s.safety?.level === 'DANGEROUS' || s.safety?.level === 'BLOCKED'
  );

  const startExecution = (dryRun: boolean = false) => {
    if (!currentPlan) return;
    if (!dryRun && hasDangerousSteps && !confirmDangerousModal) {
      setConfirmDangerousModal(true);
      return;
    }
    setConfirmDangerousModal(false);
    onExecutePlan(currentPlan, dryRun);
  };

  const executeSingleStep = async (step: PlanStep) => {
    if (!currentPlan || isExecuting) return;

    // Execute this single step
    const stepClone: PlanStep = { ...step, status: 'running' };
    setCurrentPlan((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === step.id ? stepClone : s)),
      };
    });

    try {
      let commandToRun = '';
      if (step.tool === 'shell') commandToRun = step.args.command;
      else if (step.tool === 'service') commandToRun = `systemctl ${step.args.action} ${step.args.name}`;
      else if (step.tool === 'inspect') {
        if (step.args.kind === 'git_status') commandToRun = 'git status';
        else if (step.args.kind === 'git_diff') commandToRun = 'git diff';
        else commandToRun = `echo "Inspecting ${step.args.kind}"`;
      } else if (step.tool === 'http_check') commandToRun = `curl -Is ${step.args.url} | head -n 5`;
      else if (step.tool === 'network_traffic') commandToRun = 'ip -s link';

      const resp = await fetch('/api/shell/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandToRun,
          verify: step.verify,
        }),
      });

      const resData = await resp.json();
      setCurrentPlan((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === step.id
              ? {
                  ...s,
                  status: resData.exitCode === 0 && resData.verified ? 'completed' : 'failed',
                  stdout: resData.stdout,
                  stderr: resData.stderr,
                  exitCode: resData.exitCode,
                  durationMs: resData.durationMs,
                  verified: resData.verified,
                }
              : s
          ),
        };
      });
      setStepByStepIndex((idx) => idx + 1);
    } catch (err: any) {
      setCurrentPlan((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === step.id ? { ...s, status: 'failed', stderr: err.message } : s
          ),
        };
      });
    }
  };

  const getSafetyBadge = (level?: DangerLevel) => {
    switch (level) {
      case 'SAFE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3 h-3" />
            SAFE
          </span>
        );
      case 'CAUTION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            CAUTION
          </span>
        );
      case 'DANGEROUS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3" />
            DANGEROUS
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-950 text-red-400 border border-red-800">
            <ShieldAlert className="w-3 h-3" />
            BLOCKED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-400">
            REVIEW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Natural Language Prompt Bar */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGeneratePlan();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <TerminalIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-400" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.promptPlaceholder}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all font-mono"
            />
            {prompt && (
              <button
                type="button"
                onClick={() => setPrompt('')}
                className="absolute right-3 top-3 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isPlanning || !prompt.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold text-sm rounded-lg transition-colors shadow-sm shadow-emerald-500/20"
          >
            {isPlanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{lang === 'fa' ? 'در حال تحلیل و برنامه‌ریزی...' : 'Analyzing & Planning...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t.planButton}</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Example Prompt Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
          <span className="text-zinc-500 text-[11px] font-medium mr-1">
            {lang === 'fa' ? 'دستورات پیشنهادی:' : 'Quick Prompts:'}
          </span>
          {t.quickPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(item.prompt);
                handleGeneratePlan(item.prompt);
              }}
              className="px-2.5 py-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-emerald-300 border border-zinc-700/50 transition-colors text-[11px]"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{lang === 'fa' ? 'خطا در فرآیند برنامه‌ریزی' : 'Planning Execution Failed'}</p>
            <p className="text-xs text-red-300/90">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Plan Visualizer & Execution Stage */}
      {currentPlan && (
        <div className="space-y-4">
          {/* Plan Header Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-semibold">
                    LTA Plan Schema v2.0
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {currentPlan.steps.length} {lang === 'fa' ? 'مرحله محدود' : 'bounded steps'}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-zinc-100 mt-1 flex items-center gap-2">
                  <span>{currentPlan.goal}</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">{currentPlan.summary}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => startExecution(false)}
                  disabled={isExecuting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-zinc-950 font-semibold rounded-lg text-xs transition-colors shadow-sm shadow-emerald-500/20"
                >
                  {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isExecuting ? t.executing : t.executeAll}</span>
                </button>

                <button
                  onClick={() => startExecution(true)}
                  disabled={isExecuting}
                  title="Simulate plan execution without modifying host state"
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-lg text-xs border border-zinc-700 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t.dryRun}</span>
                </button>

                <button
                  onClick={handleExportPlanJson}
                  title="Export strict plan JSON (compatible with lta run-plan)"
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs border border-zinc-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t.exportPlan}</span>
                </button>

                <button
                  onClick={handleCopyLtaCli}
                  title="Copy command for Linux Terminal Agent CLI"
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs border border-zinc-700 transition-colors"
                >
                  {copiedStepId === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                  <span>{copiedStepId === 'cli' ? 'Copied!' : t.copyCli}</span>
                </button>
              </div>
            </div>

            {/* Steps Flow / DAG */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span className="font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  {lang === 'fa' ? 'مراحل اجرایی و راستی‌آزمایی' : 'Execution Pipeline & Verifications'}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {lang === 'fa' ? 'تایید دستی هر مرحله امکان‌پذیر است' : 'Step-by-step approval enabled'}
                </span>
              </div>

              {currentPlan.steps.map((step, idx) => {
                const isExpanded = expandedSteps[step.id] ?? true;
                const isCurrentNext = idx === stepByStepIndex;

                return (
                  <div
                    key={step.id}
                    className={`border rounded-lg transition-all ${
                      step.status === 'running'
                        ? 'border-emerald-500/80 bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                        : step.status === 'completed'
                        ? 'border-emerald-800/40 bg-zinc-950/60'
                        : step.status === 'failed'
                        ? 'border-rose-800/60 bg-rose-950/20'
                        : 'border-zinc-800 bg-zinc-950/40'
                    }`}
                  >
                    {/* Step Card Summary Header */}
                    <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                        <button
                          type="button"
                          onClick={() => toggleStepExpand(step.id)}
                          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {/* Status Icon */}
                        <div className="shrink-0">
                          {step.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                          {step.status === 'failed' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                          {step.status === 'running' && <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />}
                          {(!step.status || step.status === 'pending') && (
                            <span className="w-5 h-5 rounded-full border border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-400">
                              {idx + 1}
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-zinc-300">{step.id}</span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[11px] font-mono text-zinc-400 uppercase">
                              {step.tool}
                            </span>
                            {getSafetyBadge(step.safety?.level)}
                          </div>
                          <p className="text-xs text-zinc-200 font-medium mt-0.5">{step.title}</p>
                        </div>
                      </div>

                      {/* Badges & Step Controls */}
                      <div className="flex items-center gap-2">
                        {step.depends_on && step.depends_on.length > 0 && (
                          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                            dep: {step.depends_on.join(', ')}
                          </span>
                        )}

                        {step.durationMs !== undefined && (
                          <span className="text-[11px] font-mono text-zinc-400">
                            {step.durationMs}ms
                          </span>
                        )}

                        {/* Single Step Trigger */}
                        {step.status !== 'completed' && !isExecuting && (
                          <button
                            onClick={() => executeSingleStep(step)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-700/60 border border-zinc-700 rounded text-xs font-mono transition-colors"
                            title="Execute only this step"
                          >
                            <Play className="w-3 h-3" />
                            <span>Run Step</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step Expanded Details & Output */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 space-y-2 text-xs">
                        {/* Arguments / Command */}
                        <div className="bg-zinc-900/90 rounded p-2.5 font-mono text-zinc-300 flex items-start justify-between gap-2 border border-zinc-800/80">
                          <div className="overflow-x-auto">
                            {step.tool === 'shell' && (
                              <p className="text-emerald-300 font-mono select-all">
                                <span className="text-zinc-500">$ </span>
                                {step.args.command}
                              </p>
                            )}
                            {step.tool === 'service' && (
                              <p className="text-cyan-300 font-mono">
                                <span className="text-zinc-500">$ </span>
                                systemctl {step.args.action} {step.args.name}
                              </p>
                            )}
                            {step.tool === 'write_file' && (
                              <div>
                                <p className="text-amber-300 font-mono">write_file: {step.args.path}</p>
                                <pre className="text-[11px] text-zinc-400 mt-1 max-h-24 overflow-y-auto">
                                  {step.args.content}
                                </pre>
                              </div>
                            )}
                            {step.tool === 'http_check' && (
                              <p className="text-blue-300 font-mono">http_check: {step.args.url}</p>
                            )}
                            {step.tool === 'network_traffic' && (
                              <p className="text-purple-300 font-mono">
                                network_traffic: sample {step.args.seconds}s (interval: {step.args.interval}s)
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              handleCopyCommand(
                                step.args.command || JSON.stringify(step.args, null, 2),
                                step.id
                              )
                            }
                            className="p-1 text-zinc-500 hover:text-zinc-200"
                            title="Copy command"
                          >
                            {copiedStepId === step.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Safety Reason If Caution / Dangerous / Blocked */}
                        {step.safety && step.safety.level !== 'SAFE' && (
                          <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-amber-200/90 text-[11px]">
                            <p className="font-semibold flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              {lang === 'fa' ? 'هشدار خط‌مشی امنیتی:' : 'Security Policy Advisory:'}
                            </p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                              {step.safety.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                            {step.safety.suggestedSafeAlternative && (
                              <p className="mt-1 text-emerald-300 font-mono">
                                💡 Suggested safe alternative: {step.safety.suggestedSafeAlternative}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Verification Criteria */}
                        {step.verify && step.verify.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400">
                            <span className="text-zinc-500">Verification Gate:</span>
                            {step.verify.map((v, vi) => (
                              <span
                                key={vi}
                                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
                              >
                                {v.expected_exit !== undefined && `exit == ${v.expected_exit}`}
                                {v.contains && ` contains("${v.contains}")`}
                                {v.status_code && ` HTTP ${v.status_code}`}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Execution Output (stdout / stderr) */}
                        {(step.stdout || step.stderr) && (
                          <div className="mt-2 bg-zinc-950 border border-zinc-800 rounded p-3 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
                            {step.stdout && <pre className="text-zinc-200 whitespace-pre-wrap">{step.stdout}</pre>}
                            {step.stderr && (
                              <pre className="text-rose-400 mt-1 whitespace-pre-wrap">{step.stderr}</pre>
                            )}
                            <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                              <span>Exit Code: {step.exitCode}</span>
                              <span className={step.verified ? 'text-emerald-400' : 'text-amber-400'}>
                                {step.verified ? '✓ Verification passed' : '⚠ Verification pending'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dangerous Confirmation Modal */}
      {confirmDangerousModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-rose-800/80 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-zinc-100">
                {lang === 'fa' ? 'تایید اجرای دستورات حساس' : 'Confirm Execution of High-Risk Steps'}
              </h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === 'fa'
                ? 'این برنامه شامل مراحلی با سطح ریسک DANGEROUS یا CAUTION است. آیا از اجرای آن در محیط لینوکس اطمینان دارید؟'
                : 'This plan contains steps flagged as DANGEROUS or CAUTION by LTA Safety Policy. Are you sure you want to approve execution on this host?'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDangerousModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg font-medium"
              >
                {lang === 'fa' ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setConfirmDangerousModal(false);
                  if (currentPlan) onExecutePlan(currentPlan, false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-lg font-semibold shadow-md shadow-rose-600/30"
              >
                {lang === 'fa' ? 'تایید و اجرا' : 'Approve & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Stethoscope,
  Boxes,
  Activity,
  History,
  ShieldAlert,
  Sliders,
  Sparkles,
  Command,
} from 'lucide-react';
import { Header } from './components/Header';
import { TerminalPlanner } from './components/TerminalPlanner';
import { InteractiveCLI } from './components/InteractiveCLI';
import { DoctorCenter } from './components/DoctorCenter';
import { SkillsHub } from './components/SkillsHub';
import { TelemetryMonitor } from './components/TelemetryMonitor';
import { DiffVault } from './components/DiffVault';
import { SafetyExplainer } from './components/SafetyExplainer';
import { ConfigSessionsModal } from './components/ConfigSessionsModal';
import { LTAPlan, UsageBudget, PlanStep } from './types/terminal';
import { TRANSLATIONS } from './utils/persianDict';

export default function App() {
  const [lang, setLang] = useState<'en' | 'fa'>('fa');
  const [activeTab, setActiveTab] = useState<
    'planner' | 'terminal' | 'doctor' | 'skills' | 'monitor' | 'diffVault' | 'explainer'
  >('planner');

  const [provider, setProvider] = useState<string>('gemini');
  const [localOnly, setLocalOnly] = useState<boolean>(false);
  const [routeSimple, setRouteSimple] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<LTAPlan | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  const [budget, setBudget] = useState<UsageBudget>({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCalls: 0,
    estimatedCostUsd: 0.0,
    budgetLimitUsd: 1.0,
    lastLatencyMs: 0,
  });

  const t = TRANSLATIONS[lang];

  // Set document direction based on language
  useEffect(() => {
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Execute multi-step LTA Plan
  const handleExecutePlan = async (plan: LTAPlan, dryRun: boolean = false) => {
    setIsExecuting(true);

    const updatedSteps = [...plan.steps];

    for (let i = 0; i < updatedSteps.length; i++) {
      const step = updatedSteps[i];

      // Mark step running
      updatedSteps[i] = { ...step, status: 'running' };
      setCurrentPlan({ ...plan, steps: [...updatedSteps] });

      if (dryRun) {
        await new Promise((r) => setTimeout(r, 600));
        updatedSteps[i] = {
          ...step,
          status: 'completed',
          stdout: `[DRY-RUN SIMULATION] Verified step dependencies: ${step.depends_on?.join(', ') || 'none'}. Tool "${step.tool}" would execute cleanly.`,
          exitCode: 0,
          durationMs: 15,
          verified: true,
        };
        setCurrentPlan({ ...plan, steps: [...updatedSteps] });
        continue;
      }

      // Real bounded execution
      try {
        let commandToRun = '';
        if (step.tool === 'shell') {
          commandToRun = step.args.command;
        } else if (step.tool === 'service') {
          commandToRun = `systemctl ${step.args.action} ${step.args.name}`;
        } else if (step.tool === 'inspect') {
          if (step.args.kind === 'git_status') commandToRun = 'git status';
          else if (step.args.kind === 'git_diff') commandToRun = 'git diff';
          else if (step.args.kind === 'git_log') commandToRun = 'git log -n 5 --oneline';
          else commandToRun = `echo "Inspecting ${step.args.kind}"`;
        } else if (step.tool === 'http_check') {
          commandToRun = `curl -Is ${step.args.url} | head -n 5`;
        } else if (step.tool === 'network_traffic') {
          commandToRun = 'ip -s link';
        } else if (step.tool === 'write_file') {
          // Send to write_file endpoint
          const writeResp = await fetch('/api/files/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: step.args.path, content: step.args.content }),
          });
          const writeData = await writeResp.json();
          updatedSteps[i] = {
            ...step,
            status: writeData.success ? 'completed' : 'failed',
            stdout: `Saved atomic backup: ${writeData.backupId}\n${writeData.diff}`,
            exitCode: writeData.success ? 0 : 1,
            durationMs: 25,
            verified: true,
          };
          setCurrentPlan({ ...plan, steps: [...updatedSteps] });
          continue;
        }

        const resp = await fetch('/api/shell/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: commandToRun,
            verify: step.verify,
          }),
        });

        const resData = await resp.json();

        if (resData.blocked) {
          updatedSteps[i] = {
            ...step,
            status: 'blocked',
            stderr: `BLOCKED BY LTA SECURITY POLICY: ${resData.assessment.reasons.join(', ')}`,
            exitCode: 126,
            durationMs: resData.durationMs || 5,
            verified: false,
          };
          setCurrentPlan({ ...plan, steps: [...updatedSteps] });
          break; // Stop plan execution on security violation
        }

        const isSuccess = resData.exitCode === 0 && resData.verified;

        updatedSteps[i] = {
          ...step,
          status: isSuccess ? 'completed' : 'failed',
          stdout: resData.stdout,
          stderr: resData.stderr,
          exitCode: resData.exitCode,
          durationMs: resData.durationMs,
          verified: resData.verified,
        };

        setCurrentPlan({ ...plan, steps: [...updatedSteps] });

        // Halt on failure if exit code is unacceptable
        if (!isSuccess && (!step.accept_exit_codes || !step.accept_exit_codes.includes(resData.exitCode))) {
          break;
        }
      } catch (err: any) {
        updatedSteps[i] = {
          ...step,
          status: 'failed',
          stderr: err.message || 'Execution error',
          exitCode: 1,
          verified: false,
        };
        setCurrentPlan({ ...plan, steps: [...updatedSteps] });
        break;
      }
    }

    setIsExecuting(false);
  };

  const handleLoadPlanToPlanner = (plan: LTAPlan) => {
    setCurrentPlan(plan);
    setActiveTab('planner');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Application Bar */}
      <Header
        lang={lang}
        setLang={setLang}
        provider={provider}
        setProvider={setProvider}
        localOnly={localOnly}
        setLocalOnly={setLocalOnly}
        routeSimple={routeSimple}
        setRouteSimple={setRouteSimple}
        budget={budget}
      />

      {/* Main Workspace Navigation Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto no-scrollbar">
          <nav className="flex items-center gap-1 py-2 text-xs font-medium">
            <button
              onClick={() => setActiveTab('planner')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'planner'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.tabs.planner}</span>
              {currentPlan && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'terminal'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>{t.tabs.terminal}</span>
            </button>

            <button
              onClick={() => setActiveTab('doctor')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'doctor'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.tabs.doctor}</span>
            </button>

            <button
              onClick={() => setActiveTab('skills')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'skills'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.tabs.skills}</span>
            </button>

            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'monitor'
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>{t.tabs.monitor}</span>
            </button>

            <button
              onClick={() => setActiveTab('diffVault')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'diffVault'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.tabs.diffVault}</span>
            </button>

            <button
              onClick={() => setActiveTab('explainer')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'explainer'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Command className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.tabs.explainer}</span>
            </button>
          </nav>

          {/* Quick Settings Gear */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
            title="Session & Configuration Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
        {activeTab === 'planner' && (
          <TerminalPlanner
            lang={lang}
            provider={provider}
            localOnly={localOnly}
            routeSimple={routeSimple}
            onPlanGenerated={(plan) => setCurrentPlan(plan)}
            currentPlan={currentPlan}
            setCurrentPlan={setCurrentPlan}
            onExecutePlan={handleExecutePlan}
            isExecuting={isExecuting}
            budget={budget}
            setBudget={setBudget}
          />
        )}

        {activeTab === 'terminal' && <InteractiveCLI lang={lang} />}

        {activeTab === 'doctor' && (
          <DoctorCenter lang={lang} onLoadPlanToPlanner={handleLoadPlanToPlanner} />
        )}

        {activeTab === 'skills' && (
          <SkillsHub lang={lang} onLoadPlanToPlanner={handleLoadPlanToPlanner} />
        )}

        {activeTab === 'monitor' && <TelemetryMonitor lang={lang} />}

        {activeTab === 'diffVault' && <DiffVault lang={lang} />}

        {activeTab === 'explainer' && <SafetyExplainer lang={lang} />}
      </main>

      {/* Footer info bar */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-3 px-4 text-center text-xs text-zinc-600 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Linux Terminal Agent (LTA) &copy; 2026 Nimajavan | Bounded Execution & Safety Policy
          </span>
          <span className="text-[11px] text-zinc-500">
            Engine: {provider} | Posix Bash | Memory & Redaction Guarded
          </span>
        </div>
      </footer>

      {/* Sessions and Configuration Modal */}
      <ConfigSessionsModal
        lang={lang}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        budget={budget}
        setBudget={setBudget}
        localOnly={localOnly}
        setLocalOnly={setLocalOnly}
        routeSimple={routeSimple}
        setRouteSimple={setRouteSimple}
        currentPlan={currentPlan}
        onReplan={() => {
          if (currentPlan) {
            handleExecutePlan(currentPlan, false);
          }
        }}
      />
    </div>
  );
}

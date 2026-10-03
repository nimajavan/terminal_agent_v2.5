import React, { useState } from 'react';
import {
  Stethoscope,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowRight,
  Shield,
  Activity,
  Server,
  HardDrive,
  Cpu,
  Globe,
  Radio,
  Loader2,
} from 'lucide-react';
import { DoctorReport, LTAPlan } from '../types/terminal';
import { TRANSLATIONS } from '../utils/persianDict';

interface DoctorCenterProps {
  lang: 'en' | 'fa';
  onLoadPlanToPlanner: (plan: LTAPlan) => void;
}

export const DoctorCenter: React.FC<DoctorCenterProps> = ({ lang, onLoadPlanToPlanner }) => {
  const t = TRANSLATIONS[lang];
  const [selectedService, setSelectedService] = useState('nginx');
  const [url, setUrl] = useState('http://127.0.0.1/');
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const services = [
    { id: 'nginx', name: 'Nginx Web Server', icon: Globe, desc: 'Config syntax, port 80/443, HTTP code 200' },
    { id: 'docker', name: 'Docker Engine', icon: Server, desc: 'Daemon socket, container metrics, disk usage' },
    { id: 'systemd', name: 'Systemd Units', icon: Activity, desc: 'Failed units, journalctl priority 3 errors' },
    { id: 'disk', name: 'Disk & Filesystem', icon: HardDrive, desc: 'Volume capacity, inode limits, mount points' },
  ];

  const handleRunDoctor = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/doctor/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: selectedService, url }),
      });
      const data: DoctorReport = await resp.json();
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRepairPlan = () => {
    if (!report) return;

    // Generate strict LTA plan conforming to lta doctor --repair
    const repairPlan: LTAPlan = {
      goal: `Propose verified restart and health triage for ${report.service}`,
      summary: `Restarts ${report.service} daemon safely only after verifying configuration syntax, followed by is-active check and HTTP probe.`,
      steps: [
        {
          id: 'step_1_precheck',
          title: `Verify ${report.service} configuration syntax before applying change`,
          tool: 'shell',
          args: { command: report.service === 'nginx' ? 'nginx -t' : `systemctl status ${report.service}` },
          accept_exit_codes: [0],
        },
        {
          id: 'step_2_restart',
          title: `Gracefully reload/restart ${report.service} service`,
          tool: 'service',
          args: { name: report.service, action: 'restart' },
          depends_on: ['step_1_precheck'],
          accept_exit_codes: [0],
          verify: [
            {
              tool: 'service',
              args: { name: report.service, action: 'is-active' },
              expected_exit: 0,
            },
          ],
        },
      ],
    };

    if (report.url) {
      repairPlan.steps.push({
        id: 'step_3_http_verify',
        title: `Verify endpoint returns HTTP 200 (${report.url})`,
        tool: 'http_check',
        args: { url: report.url },
        depends_on: ['step_2_restart'],
        accept_exit_codes: [0],
        verify: [{ tool: 'http_check', url: report.url, status_code: 200 }],
      });
    }

    onLoadPlanToPlanner(repairPlan);
  };

  return (
    <div className="space-y-6">
      {/* Doctor Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-cyan-950/40 border border-emerald-500/20 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>{lang === 'fa' ? 'داکتور عیب‌یاب لینوکس (LTA Doctor)' : 'LTA Service Doctor'}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Rule-Based Triage
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {lang === 'fa'
                ? 'عیب‌یابی سریع و محلی سرویس‌ها بدون نیاز به مصرف توکن مدل با امکان پیشنهاد ریستارت امن'
                : 'Diagnose services directly via deterministic rules and propose bounded, verified recovery actions.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleRunDoctor}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-lg transition-colors shadow-sm shadow-emerald-500/20"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>{lang === 'fa' ? 'اجرای تست‌های تشخیصی' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {/* Target Service Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {services.map((svc) => {
          const Icon = svc.icon;
          const isSelected = selectedService === svc.id;
          return (
            <button
              key={svc.id}
              onClick={() => setSelectedService(svc.id)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                  : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-400' : 'text-zinc-400'}`} />
                {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
              </div>
              <h4 className="text-sm font-semibold text-zinc-100 mt-2">{svc.name}</h4>
              <p className="text-[11px] text-zinc-400 mt-1">{svc.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Optional Param Bar (e.g. URL for Nginx) */}
      {selectedService === 'nginx' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col sm:flex-row items-center gap-3">
          <label className="text-xs text-zinc-400 font-mono shrink-0">
            Health Check Probe URL:
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://127.0.0.1/health"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500"
          />
        </div>
      )}

      {/* Diagnostics Report View */}
      {report && (
        <div className="space-y-4">
          {/* Summary Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              report.healthy
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {report.healthy ? (
                <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-bold">
                  {report.healthy
                    ? (lang === 'fa' ? 'سلامت کامل سرویس تایید شد' : 'Service Diagnosed Healthy')
                    : (lang === 'fa' ? 'مسائل تشخیصی شناسایی شدند' : 'Diagnostic Anomalies Detected')}
                </h3>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Target: {report.service} | Timestamp: {new Date(report.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {report.repairProposed && (
              <button
                onClick={handleCreateRepairPlan}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold rounded-lg text-xs shadow-sm transition-colors"
              >
                <span>{lang === 'fa' ? 'تولید برنامه تعمیر در ایجنت' : 'Load Repair Plan into Agent'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Findings List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider font-semibold">
              {lang === 'fa' ? 'یافته‌های داکتور' : 'Doctor Findings & Root Causes'}
            </h4>
            <div className="space-y-2">
              {report.findings.map((f) => (
                <div
                  key={f.id}
                  className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">
                      {lang === 'fa' ? f.titleFa : f.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                        f.severity === 'ok'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : f.severity === 'warning'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    {lang === 'fa' ? f.detailsFa : f.details}
                  </p>
                  {f.suggestedAction && (
                    <p className="text-emerald-400 font-mono text-[11px] pt-1">
                      Action: {f.suggestedAction}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Raw Diagnostic Command Executions */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider font-semibold">
              {lang === 'fa' ? 'خروجی دستورات تشخیصی لینوکس' : 'Subshell Check Outputs'}
            </h4>
            <div className="space-y-2">
              {report.diagnosticOutputs.map((out, idx) => (
                <div key={idx} className="bg-zinc-950 rounded border border-zinc-800/80 p-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-zinc-400 pb-1 border-b border-zinc-800/60 mb-1.5">
                    <span className="text-emerald-400">{out.check}</span>
                    <span className="text-[10px] text-zinc-500">exit {out.exitCode}</span>
                  </div>
                  <p className="text-zinc-500 text-[11px] mb-1">$ {out.command}</p>
                  <pre className="text-zinc-300 text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {out.output || '(no output / status 0)'}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

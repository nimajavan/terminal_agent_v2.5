import React, { useState } from 'react';
import {
  Boxes,
  Play,
  Settings,
  Plus,
  ArrowRight,
  Shield,
  FileCode,
  Download,
  Upload,
  Check,
  Tag,
} from 'lucide-react';
import { BUILTIN_SKILLS } from '../utils/skillsCatalog';
import { SkillPack, LTAPlan } from '../types/terminal';
import { TRANSLATIONS } from '../utils/persianDict';

interface SkillsHubProps {
  lang: 'en' | 'fa';
  onLoadPlanToPlanner: (plan: LTAPlan) => void;
}

export const SkillsHub: React.FC<SkillsHubProps> = ({ lang, onLoadPlanToPlanner }) => {
  const t = TRANSLATIONS[lang];
  const [skillsList, setSkillsList] = useState<SkillPack[]>(BUILTIN_SKILLS);
  const [selectedSkill, setSelectedSkill] = useState<SkillPack>(BUILTIN_SKILLS[0]);
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customJson, setCustomJson] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const handleSelectSkill = (skill: SkillPack) => {
    setSelectedSkill(skill);
    const defaults: Record<string, any> = {};
    skill.parameters.forEach((p) => {
      defaults[p.name] = p.default;
    });
    setParamValues(defaults);
  };

  const handleParamChange = (name: string, val: any) => {
    setParamValues((prev) => ({ ...prev, [name]: val }));
  };

  const handleRunSkill = () => {
    const generatedPlan = selectedSkill.generatePlan(paramValues);
    onLoadPlanToPlanner(generatedPlan);
  };

  const handleImportCustom = () => {
    setCustomError(null);
    try {
      const parsed = JSON.parse(customJson);
      if (!parsed.name || !parsed.steps) {
        throw new Error('Skill pack JSON must contain "name" and "steps" array');
      }

      const newSkill: SkillPack = {
        id: parsed.id || `custom_${Date.now()}`,
        name: parsed.name,
        nameFa: parsed.nameFa || parsed.name,
        version: parsed.version || '1.0.0',
        category: parsed.category || 'devops',
        description: parsed.description || 'Custom user declarative skill pack',
        descriptionFa: parsed.descriptionFa || 'بسته مهارت اختصاصی کاربر',
        parameters: [],
        generatePlan: () => ({
          goal: parsed.goal || parsed.name,
          summary: parsed.summary || parsed.description,
          steps: parsed.steps,
        }),
        isCustom: true,
      };

      setSkillsList((prev) => [newSkill, ...prev]);
      setSelectedSkill(newSkill);
      setShowCustomModal(false);
      setCustomJson('');
    } catch (err: any) {
      setCustomError(err.message || 'Invalid JSON format');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-indigo-950/40 border border-cyan-500/20 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>{lang === 'fa' ? 'مرکز مهارت‌های LTA (Skills Hub)' : 'LTA Declarative Skills Hub'}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                CLI Compatible
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {lang === 'fa'
                ? 'مجموعه پکیج‌های استاندارد و خودکار برای Git, Docker, Systemd, Nginx, شبکه و امنیت'
                : 'Declarative, schema-validated task packs that generate bounded plans with explicit verification.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCustomModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold transition-colors"
        >
          <Plus className="w-4 h-4 text-cyan-400" />
          <span>{lang === 'fa' ? 'ورود بسته مهارتی جدید' : 'Import Skill Pack'}</span>
        </button>
      </div>

      {/* Main Grid: Skills List on Left, Config & Preview on Right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Skill Pack Cards */}
        <div className="space-y-2 md:col-span-1">
          <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-wider font-semibold mb-2">
            {lang === 'fa' ? 'مهارت‌های در دسترس' : 'Available Skill Packs'}
          </h3>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {skillsList.map((skill) => {
              const isSelected = selectedSkill.id === skill.id;
              return (
                <button
                  key={skill.id}
                  onClick={() => handleSelectSkill(skill)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-950/20 text-zinc-100 shadow-md shadow-cyan-500/10'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-zinc-100">
                      {lang === 'fa' ? skill.nameFa : skill.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      v{skill.version}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                    {lang === 'fa' ? skill.descriptionFa : skill.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Skill Detail & Configuration */}
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-100">
                  {lang === 'fa' ? selectedSkill.nameFa : selectedSkill.name}
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  lta skills run {selectedSkill.id}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {lang === 'fa' ? selectedSkill.descriptionFa : selectedSkill.description}
              </p>
            </div>

            <button
              onClick={handleRunSkill}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-zinc-950 font-semibold text-xs rounded-lg transition-colors shadow-sm shadow-cyan-500/20 shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{lang === 'fa' ? 'لود در برنامه‌ریز LTA' : 'Load into Agent'}</span>
            </button>
          </div>

          {/* Parameters Configuration Form */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider font-semibold">
              {lang === 'fa' ? 'تنظیم پارامترهای مهارت' : 'Configurable Parameters'}
            </h4>

            {selectedSkill.parameters.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">
                {lang === 'fa' ? 'این مهارت بدون پارامتر اضافی اجرا می‌شود.' : 'No configurable parameters required.'}
              </p>
            ) : (
              <div className="space-y-3">
                {selectedSkill.parameters.map((param) => (
                  <div key={param.name} className="space-y-1 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-200">
                        {lang === 'fa' ? param.labelFa : param.label}
                      </label>
                      <span className="text-[10px] font-mono text-zinc-500">--{param.name}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {lang === 'fa' ? param.descriptionFa : param.description}
                    </p>

                    {param.type === 'string' && (
                      <input
                        type="text"
                        value={paramValues[param.name] ?? param.default ?? ''}
                        onChange={(e) => handleParamChange(param.name, e.target.value)}
                        className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-cyan-500"
                      />
                    )}

                    {param.type === 'number' && (
                      <input
                        type="number"
                        value={paramValues[param.name] ?? param.default ?? 0}
                        onChange={(e) => handleParamChange(param.name, Number(e.target.value))}
                        className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-cyan-500"
                      />
                    )}

                    {param.type === 'boolean' && (
                      <label className="flex items-center gap-2 mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(paramValues[param.name] ?? param.default)}
                          onChange={(e) => handleParamChange(param.name, e.target.checked)}
                          className="rounded border-zinc-700 text-cyan-500 focus:ring-cyan-500/20"
                        />
                        <span className="text-xs text-zinc-300">
                          {lang === 'fa' ? 'فعال‌سازی این گزینه' : 'Enable this option'}
                        </span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Skill Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-cyan-400" />
              <span>Import Declarative Skill Pack JSON</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Paste a skill schema JSON matching the LTA Plan & Skill specification.
            </p>
            <textarea
              rows={8}
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              placeholder={`{
  "name": "Custom PostgreSql Health",
  "category": "storage",
  "description": "Inspects postgres service and connections",
  "steps": [
    { "id": "step_1", "title": "Check postgres active", "tool": "service", "args": { "name": "postgresql", "action": "status" } }
  ]
}`}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 outline-none focus:border-cyan-500"
            />
            {customError && <p className="text-xs text-rose-400 font-mono">{customError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCustom}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold rounded text-xs"
              >
                Import Skill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { History, RotateCcw, FileText, Check, AlertCircle, Eye, Shield, HardDrive } from 'lucide-react';
import { FileBackupRecord } from '../types/terminal';
import { TRANSLATIONS } from '../utils/persianDict';

interface DiffVaultProps {
  lang: 'en' | 'fa';
}

export const DiffVault: React.FC<DiffVaultProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [backups, setBackups] = useState<FileBackupRecord[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<FileBackupRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Quick testing file writer state
  const [testPath, setTestPath] = useState('demo-config.json');
  const [testContent, setTestContent] = useState('{\n  "version": "1.0",\n  "status": "active"\n}');

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/files/backups');
      const data = await resp.json();
      setBackups(data);
      if (data.length > 0 && !selectedBackup) {
        setSelectedBackup(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleRollback = async (backupId: string) => {
    try {
      const resp = await fetch('/api/files/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      });
      const data = await resp.json();
      if (data.success) {
        setMsg({ text: `Successfully rolled back using ${backupId}` });
        fetchBackups();
      } else {
        setMsg({ text: data.error, isError: true });
      }
    } catch (err: any) {
      setMsg({ text: err.message, isError: true });
    }
  };

  const handleApplyTestWrite = async () => {
    try {
      const resp = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: testPath, content: testContent }),
      });
      const data = await resp.json();
      if (data.success) {
        setMsg({ text: `Atomic file write created backup: ${data.backupId}` });
        fetchBackups();
      }
    } catch (err: any) {
      setMsg({ text: err.message, isError: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>{lang === 'fa' ? 'بایگانی تغییرات فایل و رول‌بک (Diff & Rollback Vault)' : 'File Diff & Rollback Vault'}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                Atomic Snapshots
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {lang === 'fa'
                ? 'نمایش تغییرات واحد (Unified Diff) برای هر ویرایش فایل و امکان بازگردانی در هر زمان'
                : 'Atomic snapshot journals with unified diff preview. Reverts file mutations safely.'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchBackups}
          className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold"
        >
          {lang === 'fa' ? 'بروزرسانی لیست بکاپ‌ها' : 'Refresh Backups'}
        </button>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-lg text-xs font-mono border flex items-center justify-between ${
            msg.isError
              ? 'bg-rose-950/40 border-rose-800 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-zinc-400 hover:text-zinc-200">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Backups List on Left, Diff on Right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Backups List */}
        <div className="space-y-3 md:col-span-1">
          <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-wider font-semibold">
            {lang === 'fa' ? 'بکاپ‌های ثبت‌شده' : 'Available Snapshots'} ({backups.length})
          </h3>

          {backups.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center text-xs text-zinc-500 space-y-2">
              <FileText className="w-8 h-8 mx-auto text-zinc-600" />
              <p>{lang === 'fa' ? 'هنوز فایلی توسط ایجنت بازنویسی نشده است.' : 'No file mutations recorded yet.'}</p>
              <p className="text-[11px] text-zinc-600">
                {lang === 'fa'
                  ? 'وقتی ایجنت از ابزار write_file استفاده کند، بکاپ ایجاد می‌شود.'
                  : 'Snapshots are saved automatically whenever write_file is executed.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {backups.map((bk) => {
                const isSelected = selectedBackup?.id === bk.id;
                return (
                  <button
                    key={bk.id}
                    onClick={() => setSelectedBackup(bk)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-950/20 text-zinc-100 shadow-md shadow-amber-500/10'
                        : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-400 truncate max-w-[140px]">
                        {bk.id}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(bk.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-zinc-300 truncate mt-1">{bk.path}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Sandbox Tester */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold text-zinc-200">
              {lang === 'fa' ? 'تست ویرایش امن فایل و ایجاد بکاپ' : 'Simulate Atomic File Tool'}
            </h4>
            <input
              type="text"
              value={testPath}
              onChange={(e) => setTestPath(e.target.value)}
              placeholder="Filename"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs font-mono text-zinc-200"
            />
            <textarea
              rows={3}
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200"
            />
            <button
              onClick={handleApplyTestWrite}
              className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold rounded text-xs transition-colors"
            >
              {lang === 'fa' ? 'اعمال ویرایش و ذخیره بکاپ' : 'Write File & Create Backup'}
            </button>
          </div>
        </div>

        {/* Right: Unified Diff Preview */}
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          {selectedBackup ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-100 font-mono truncate">{selectedBackup.path}</h4>
                  <p className="text-xs text-zinc-400 font-mono">
                    Snapshot ID: {selectedBackup.id} | Timestamp: {selectedBackup.timestamp}
                  </p>
                </div>
                <button
                  onClick={() => handleRollback(selectedBackup.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-rose-600/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'fa' ? 'رول‌بک و بازگردانی این فایل' : 'Rollback this File'}</span>
                </button>
              </div>

              {/* Diff Output */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs overflow-x-auto max-h-[420px] overflow-y-auto">
                {selectedBackup.diff.split('\n').map((line, idx) => {
                  let lineClass = 'text-zinc-400';
                  if (line.startsWith('+') && !line.startsWith('+++')) lineClass = 'text-emerald-400 bg-emerald-950/30';
                  else if (line.startsWith('-') && !line.startsWith('---')) lineClass = 'text-rose-400 bg-rose-950/30';
                  else if (line.startsWith('@@')) lineClass = 'text-cyan-400 bg-cyan-950/20';

                  return (
                    <div key={idx} className={`px-2 py-0.5 rounded-sm ${lineClass}`}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-zinc-500 font-mono">
              Select a snapshot from the list to preview unified diff.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

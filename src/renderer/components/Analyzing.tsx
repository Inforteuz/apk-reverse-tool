import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { Database, Code, Compass, KeyRound, Terminal } from 'lucide-react';

const MacSpinner = () => (
  <div className="mac-spinner lg text-primary">
    {Array.from({ length: 12 }).map((_, i) => <div key={i} />)}
  </div>
);

export default function Analyzing() {
  const t = useAppStore(state => state.t);
  const selectedFile = useAppStore(state => state.selectedFile);
  const progress = useAppStore(state => state.progress);
  const filename = selectedFile ? selectedFile.split('/').pop() : '';

  const [logs, setLogs] = useState<{ time: string; message: string }[]>([]);
  const [stats, setStats] = useState({ dex: '–', strings: '–', endpoints: '–', secrets: '–' });
  const logBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progress.message) {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setLogs(prev => [...prev, { time, message: progress.message }]);

      const dexMatch = progress.message.match(/(\d+)\s*ta DEX/);
      if (dexMatch) setStats(s => ({ ...s, dex: dexMatch[1] }));

      const strMatch = progress.message.match(/(\d[\d,]*)\s*ta string/);
      if (strMatch) setStats(s => ({ ...s, strings: Number(strMatch[1].replace(/,/g, '')).toLocaleString() }));

      const epMatch = progress.message.match(/(\d+)\s*ta endpoint/);
      if (epMatch) setStats(s => ({ ...s, endpoints: epMatch[1] }));
    }
  }, [progress.message]);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex-1 flex items-center justify-center p-6 w-full max-w-3xl mx-auto animate-fade-in">
      <div className="surface rounded-2xl w-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-white/[0.06]">
          <MacSpinner />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[10px] font-semibold text-primary-light uppercase tracking-wider">{t('an.title')}</span>
            <h2 className="text-base font-semibold text-default truncate" title={filename || ''}>{filename}</h2>
          </div>
          <div className="text-right hidden md:flex flex-col items-end gap-1">
            <span className="status-dot live" />
            <span className="text-[10px] text-success font-semibold">{t('common.active')}</span>
          </div>
        </div>

        {/* Big percent + progress bar */}
        <div className="px-6 py-6 flex flex-col gap-3">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-semibold text-default leading-none">{Math.round(progress.percent)}<span className="text-xl text-muted">%</span></span>
            <span className="text-xs text-soft">{progress.message || t('common.starting')}</span>
          </div>
          <div className="mac-progress">
            <div style={{ width: `${progress.percent}%` }} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { Icon: Database, label: t('an.dex'),       value: stats.dex },
            { Icon: Code,     label: t('an.strings'),  value: stats.strings },
            { Icon: Compass,  label: t('an.endpoints'),value: stats.endpoints },
            { Icon: KeyRound, label: t('an.secrets'),  value: stats.secrets },
          ].map(({ Icon, label, value }, i) => (
            <div key={i} className="surface-2 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-muted mb-1.5">
                <Icon className="w-3 h-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              </div>
              <span className="text-lg font-semibold text-default">{value}</span>
            </div>
          ))}
        </div>

        {/* Log */}
        <div className="border-t border-white/[0.06] bg-black/30">
          <div className="flex items-center justify-between px-5 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-2 text-muted">
              <Terminal className="w-3 h-3" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">{t('an.log')}</span>
            </div>
          </div>
          <div ref={logBoxRef} className="px-5 py-3 h-40 overflow-y-auto mono text-[10.5px] flex flex-col gap-1">
            {logs.length === 0 ? (
              <span className="text-muted">{t('an.waiting')}</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex gap-2 leading-relaxed">
                  <span className="text-muted">{log.time}</span>
                  <span className="text-primary">›</span>
                  <span className="text-soft flex-1">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

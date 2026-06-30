import { ExternalLink, Globe, Code, Mail, Server, Layers, Sparkles } from 'lucide-react';
import { useAppStore } from '../store';

export const AboutDev: React.FC = () => {
  const t = useAppStore(state => state.t);

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    window.electronAPI.openExternal(url);
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl animate-fade-in pb-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-default">{t('about.title')}</h3>
        <p className="text-xs text-soft">Personal project</p>
      </div>

      {/* Profile Card */}
      <div className="surface rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-5 items-center md:items-start">
          <div className="relative flex-shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden">
              <img
                className="w-full h-full object-cover"
                src="https://inforte.uz/api/storage/uploads/profile/4ff3f16cf4e801c177317a80bee927b2.webp"
                alt="Oyatillo"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 flex items-center gap-1 surface rounded-full px-2 py-0.5">
              <span className="status-dot live" />
              <span className="text-[9px] font-semibold text-success uppercase">{t('common.active')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-1 text-center md:text-left">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h4 className="text-xl font-semibold text-default">Oyatillo</h4>
                <span className="pill">23</span>
              </div>
              <span className="text-sm text-primary-light font-medium">{t('about.role')}</span>
              <span className="text-xs text-muted">{t('about.location')}</span>
            </div>

            <p className="text-xs leading-relaxed text-soft max-w-xl">{t('about.about')}</p>

            <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
              {[
                { Icon: Server,   label: 'Backend' },
                { Icon: Layers,   label: 'Frontend' },
                { Icon: Code,     label: 'TypeScript' },
                { Icon: Sparkles, label: 'Reverse Engineering' },
              ].map((b, idx) => (
                <span key={idx} className="pill">
                  <b.Icon className="w-2.5 h-2.5 text-primary-light" />
                  {b.label}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              <a
                href="https://inforte.uz"
                onClick={(e) => handleLinkClick(e, 'https://inforte.uz')}
                className="btn btn-primary text-xs"
              >
                <Globe className="w-3 h-3" />
                inforte.uz
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
              <a
                href="mailto:anoyatillo16@gmail.com"
                onClick={(e) => handleLinkClick(e, 'mailto:anoyatillo16@gmail.com')}
                className="btn btn-secondary text-xs"
              >
                <Mail className="w-3 h-3" />
                anoyatillo16@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* App info */}
      <div className="surface rounded-xl p-5">
        <h4 className="text-sm font-semibold text-default mb-3">{t('about.projectInfo')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {[
            { k: 'Project',     v: 'APK Reverse Tool' },
            { k: 'Version',     v: '1.2.0' },
            { k: 'Author',      v: 'Oyatillo' },
            { k: 'Stack',       v: 'Electron · React 19 · TS · Tailwind' },
            { k: 'Platform',    v: 'macOS (arm64 + x64)' },
            { k: 'License',     v: 'MIT' },
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
              <span className="text-soft">{row.k}</span>
              <span className="mono text-default text-right">{row.v}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-white/[0.04] text-[11px] text-muted leading-relaxed">
          {t('about.disclaimer')}
        </div>
      </div>
    </div>
  );
};

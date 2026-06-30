import { useState } from 'react';
import { useAppStore } from '../store';
import { LANGS } from '../i18n';
import {
  UploadCloud, FolderOpen, AlertCircle, Trash2, Terminal,
  Smartphone, ChevronRight, Globe, Shield, Code, KeyRound, Compass, Database,
  Sparkles
} from 'lucide-react';

const OPTION_KEYS = [
  { key: 'endpoints', Icon: Compass },
  { key: 'payloads',  Icon: Code },
  { key: 'headers',   Icon: Terminal },
  { key: 'secrets',   Icon: KeyRound },
  { key: 'manifest',  Icon: Shield },
  { key: 'firebase',  Icon: Database },
];

export default function Welcome() {
  const t = useAppStore(state => state.t);
  const lang = useAppStore(state => state.lang);
  const setLang = useAppStore(state => state.setLang);
  const selectedFile = useAppStore(state => state.selectedFile);
  const setSelectedFile = useAppStore(state => state.setSelectedFile);
  const setScreen = useAppStore(state => state.setScreen);
  const setAnalysisData = useAppStore(state => state.setAnalysisData);
  const setProgress = useAppStore(state => state.setProgress);
  const history = useAppStore(state => state.history);
  const deleteHistoryItem = useAppStore(state => state.deleteHistoryItem);
  const setCustomBaseUrl = useAppStore(state => state.setCustomBaseUrl);

  const [dragOver, setDragOver] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  const [options, setOptions] = useState({
    endpoints: true,
    payloads: true,
    headers: true,
    secrets: true,
    manifest: true,
    firebase: true,
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setErrorText('');
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.name.endsWith('.apk') || file.name.endsWith('.xapk')) {
        setSelectedFile(file.path || null);
      } else {
        setErrorText(t('welcome.invalidFile'));
      }
    }
  };

  const handleBrowseClick = async () => {
    setErrorText('');
    const path = await window.electronAPI.openAPKDialog();
    if (path) setSelectedFile(path);
  };

  const clearSelectedFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
  };

  const toggleOption = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setProgress({ percent: 0, message: t('common.starting') });
    setScreen('analyzing');

    const cleanup = window.electronAPI.onProgress((data) => {
      setProgress({ percent: data.percent, message: data.message });
    });

    try {
      const result = await window.electronAPI.analyzeAPK(selectedFile, options);
      cleanup();

      if (result.success) {
        setAnalysisData(result);
        setCustomBaseUrl('');
        useAppStore.getState().saveToHistory(result);
        setScreen('results');
      } else {
        setErrorText(`Error: ${result.error}`);
        setScreen('welcome');
      }
    } catch (err: any) {
      cleanup();
      setErrorText(`Error: ${err.message}`);
      setScreen('welcome');
    }
  };

  const handleHistoryItemClick = (item: any) => {
    setSelectedFile(item.filePath);
    setAnalysisData(item.results);
    setCustomBaseUrl('');
    setScreen('results');
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const filename = selectedFile ? selectedFile.split('/').pop() : '';
  const enabledCount = Object.values(options).filter(Boolean).length;
  const currentLang = LANGS.find(l => l.code === lang);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto animate-fade-in">
      <div className="w-full max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-10">

        {/* Top bar — lang switcher */}
        <div className="flex justify-between items-center mb-8 no-drag">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg surface flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5 text-primary" strokeWidth={2.2} />
            </div>
            <span className="text-sm font-semibold">APK Reverse Tool</span>
            <span className="pill">{t('welcome.tagline.v')}</span>
          </div>

          {/* Lang switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(v => !v)}
              className="btn btn-secondary text-xs"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{currentLang?.flag} {currentLang?.label}</span>
            </button>
            {langOpen && (
              <div
                className="absolute top-full right-0 mt-1.5 w-40 surface rounded-lg overflow-hidden z-30 animate-scale-in shadow-xl"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                {LANGS.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/[0.06] ${
                      l.code === lang ? 'text-primary-light' : 'text-default'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                    {l.code === lang && <span className="ml-auto text-primary">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hero */}
        <header className="flex flex-col items-center gap-4 text-center mb-10">
          <div className="w-14 h-14 rounded-2xl surface flex items-center justify-center">
            <Smartphone className="w-7 h-7 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-2 max-w-xl">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">APK Reverse Tool</h1>
            <p className="text-sm text-soft">{t('welcome.subtitle')}</p>
          </div>
        </header>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: Upload + Options */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Drag & Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleBrowseClick}
              className={`relative no-drag border border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all overflow-hidden ${
                dragOver
                  ? 'border-primary/60 bg-primary/[0.06]'
                  : 'border-white/10 surface-2 hover:border-white/20'
              }`}
            >
              <div className="p-3.5 rounded-xl surface mb-3 text-soft">
                <UploadCloud className="w-7 h-7" strokeWidth={1.5} />
              </div>

              <h3 className="text-sm font-medium text-default mb-1">{t('welcome.dropTitle')}</h3>
              <p className="text-xs text-muted mb-4">{t('welcome.dropSubtitle')}</p>

              <button
                type="button"
                className="btn btn-secondary no-drag"
                onClick={(e) => { e.stopPropagation(); handleBrowseClick(); }}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {t('welcome.browse')}
              </button>

              <p className="text-[10px] text-muted mt-4">{t('welcome.fileFormats')}</p>
            </div>

            {/* Selected File */}
            {selectedFile && (
              <div className="surface rounded-xl p-3 flex items-center justify-between animate-scale-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-md bg-primary/10 text-primary flex-shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-default truncate">{filename}</span>
                    <span className="text-[10px] text-muted truncate mono">{selectedFile}</span>
                  </div>
                </div>
                <button onClick={clearSelectedFile} className="btn btn-ghost text-[11px]">
                  {t('common.remove')}
                </button>
              </div>
            )}

            {errorText && (
              <div className="flex gap-2 items-start surface rounded-xl p-3 text-xs animate-scale-in" style={{ borderLeft: '3px solid #ff453a' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-danger" />
                <span className="text-danger">{errorText}</span>
              </div>
            )}

            {/* Options */}
            <div className="surface rounded-xl p-4 no-drag">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-default">{t('welcome.optionsTitle')}</h2>
                <span className="text-[10px] text-muted">{enabledCount}/6 {t('welcome.modulesActive')}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {OPTION_KEYS.map(({ key, Icon }) => {
                  const val = options[key as keyof typeof options];
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border ${
                        val ? 'border-primary/30 bg-primary/[0.06] text-default' : 'border-white/[0.06] text-muted hover:border-white/10'
                      }`}
                    >
                      <input type="checkbox" checked={val} onChange={() => toggleOption(key as keyof typeof options)} className="sr-only" />
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                        val ? 'bg-primary border-primary' : 'border-white/30'
                      }`}>
                        {val && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <Icon className={`w-3.5 h-3.5 ${val ? 'text-primary-light' : 'text-muted'}`} />
                      <span className="text-[11px] font-medium">{t(`mod.${key}`)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Analyze button */}
            <button
              type="button"
              disabled={!selectedFile}
              onClick={handleStartAnalysis}
              className="btn btn-primary w-full py-3 text-sm font-semibold no-drag"
            >
              {t('welcome.start')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: History + Features */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="surface rounded-xl p-4 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-default">{t('welcome.history')}</h2>
                <span className="text-[10px] text-muted">{history.length}/6</span>
              </div>

              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 gap-2">
                  <span className="text-xs text-muted font-medium">{t('welcome.historyEmpty')}</span>
                  <span className="text-[10px] text-muted max-w-[220px]">{t('welcome.historyHint')}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 max-h-[420px]">
                  {history.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => handleHistoryItemClick(item)}
                      className="group flex items-center justify-between p-2.5 rounded-lg surface-2 hover:bg-white/[0.06] cursor-pointer transition-colors no-drag"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary flex-shrink-0">
                          <Smartphone className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-medium text-default truncate max-w-[180px]">{item.fileName}</span>
                          <span className="text-[10px] text-muted truncate max-w-[180px] mono">{item.packageName}</span>
                          <span className="text-[9px] text-muted mt-0.5">{formatBytes(item.fileSize)} · {item.scannedAt}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteHistoryItem(index); }}
                        className="btn btn-ghost p-1.5 opacity-0 group-hover:opacity-100"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="surface rounded-xl p-4">
              <h3 className="text-xs font-semibold text-default mb-2.5">{t('welcome.features')}</h3>
              <ul className="flex flex-col gap-1.5 text-[11px] text-soft">
                {['feat1', 'feat2', 'feat3', 'feat4'].map((k) => (
                  <li key={k} className="flex items-start gap-2">
                    <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                    <span>{t(`welcome.${k}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <footer className="mt-8 flex items-center justify-between text-[10px] text-muted">
          <span>© 2026 Oyatillo · APK Reverse Tool</span>
          <button
            onClick={() => window.electronAPI.toggleDevTools()}
            className="hover:text-soft transition-colors no-drag flex items-center gap-1.5"
          >
            <Terminal className="w-3 h-3" />
            {t('common.devTools')}
          </button>
        </footer>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { LANGS } from '../i18n';
import { AboutDev } from './AboutDev';
import { AiAnalysis } from './AiAnalysis';
import { Postman } from './Postman';
import {
  ArrowLeft, Search, Copy, Compass, Code, KeyRound, ListTodo, Shield, Database,
  Sparkles, User, ChevronRight, LayoutDashboard, Link2,
  Globe, Network, Activity, AlertTriangle, Lock, Smartphone, FileText, ExternalLink,
  Hash, FileCode, FileJson, Cpu, Calendar, PanelLeftClose, PanelLeftOpen,
  Layers
} from 'lucide-react';

type Tab =
  | 'overview' | 'endpoints' | 'payloads' | 'secrets' | 'headers' | 'manifest'
  | 'firebase' | 'deeplinks' | 'network' | 'graphql' | 'allstrings' | 'postman' | 'ai' | 'developer';

const SEV_COLORS: Record<string, string> = {
  critical: 'sev-critical',
  high:     'sev-high',
  medium:   'sev-medium',
  low:      'sev-low',
};

const METHOD_CLASS: Record<string, string> = {
  GET:    'method-get',
  POST:   'method-post',
  PUT:    'method-put',
  DELETE: 'method-delete',
  PATCH:  'method-patch',
};

const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
};


export default function Results() {
  const t = useAppStore(state => state.t);
  const lang = useAppStore(state => state.lang);
  const setLang = useAppStore(state => state.setLang);
  const analysisData = useAppStore(state => state.analysisData);
  const setScreen = useAppStore(state => state.setScreen);
  const activeTab = useAppStore(state => state.activeTab) as Tab;
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const searchQuery = useAppStore(state => state.searchQuery);
  const setSearchQuery = useAppStore(state => state.setSearchQuery);
  const activeMethod = useAppStore(state => state.activeMethod);
  const setActiveMethod = useAppStore(state => state.setActiveMethod);
  const customBaseUrl = useAppStore(state => state.customBaseUrl);
  const setCustomBaseUrl = useAppStore(state => state.setCustomBaseUrl);
  const loadPostmanRequest = useAppStore(state => state.loadPostmanRequest);

  const allStringsPage = useAppStore(state => state.allStringsPage);
  const setAllStringsPage = useAppStore(state => state.setAllStringsPage);
  const allStringsPerPage = useAppStore(state => state.allStringsPerPage);

  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [showSecretValue, setShowSecretValue] = useState<Record<number, boolean>>({});
  const [endpointConfFilter, setEndpointConfFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const pkg = analysisData?.manifest?.packageName
    || analysisData?.fallbackPackageName
    || (analysisData?.apkMeta?.isXAPK ? 'Split XAPK' : '—');

  const version = analysisData?.manifest?.versionName
    ? `v${analysisData.manifest.versionName}${analysisData.manifest.versionCode ? ' (' + analysisData.manifest.versionCode + ')' : ''}`
    : (analysisData?.apkMeta?.isXAPK ? `${analysisData.apkMeta.splitCount} APKs` : '');

  // Base URL suggestion
  const guessBaseUrls = (packageName: string) => {
    if (!packageName || packageName === '—') return [];
    const parts = packageName.split('.');
    if (parts.length < 2) return [];
    const clean = parts.filter(p => !['com', 'org', 'net', 'uz', 'ru', 'gov', 'app', 'android', 'androidx', 'google'].includes(p.toLowerCase()));
    if (clean.length === 0) return [];
    let tld = 'uz';
    if (parts.includes('com')) tld = 'com';
    else if (parts.includes('net')) tld = 'net';
    else if (parts.includes('org')) tld = 'org';
    const main = clean[0].toLowerCase();
    return [`https://api.${main}.${tld}`, `https://${main}.${tld}`];
  };

  const suggestedUrls = useMemo(() => {
    return [...new Set([
      ...(analysisData?.primaryBaseUrl ? [analysisData.primaryBaseUrl] : []),
      ...(analysisData?.baseUrls || []),
      ...guessBaseUrls(pkg),
    ])];
  }, [pkg, analysisData]);

  useEffect(() => {
    if (!customBaseUrl && analysisData?.primaryBaseUrl) {
      setCustomBaseUrl(analysisData.primaryBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisData]);

  const resolveUrl = (ep: any): string => {
    if (!ep) return '';
    if (ep.type === 'full_url') return ep.url;
    const base = (customBaseUrl || analysisData?.primaryBaseUrl || '').trim();
    if (!base) return ep.url || ep.path || '';
    const cleanBase = base.replace(/\/+$/, '');
    const cleanPath = (ep.path || ep.url || '').replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast(t('common.copied'), 'success'),
      () => showToast(t('common.copyFailed'), 'error')
    );
  };

  const openInTester = (ep: any) => {
    const url = resolveUrl(ep);

    // Build initial body from inferredPayloadKeys
    let body = '';
    if (ep.inferredPayloadKeys?.length && ['POST', 'PUT', 'PATCH'].includes(ep.method)) {
      const obj: Record<string, any> = {};
      for (const key of ep.inferredPayloadKeys) {
        const k = String(key).toLowerCase();
        if (k.endsWith('_id') || k === 'id') obj[key] = 1;
        else if (k.includes('email')) obj[key] = 'user@example.com';
        else if (k.includes('password')) obj[key] = '••••••••';
        else if (k.includes('phone')) obj[key] = '+998901234567';
        else if (k.includes('code') || k.includes('otp')) obj[key] = '123456';
        else if (k.includes('token')) obj[key] = '<token>';
        else if (k.includes('amount') || k.includes('price')) obj[key] = 0;
        else if (k.includes('limit') || k.includes('page')) obj[key] = 10;
        else if (k === 'answers') obj[key] = ['<answer>'];
        else obj[key] = '<string>';
      }
      body = JSON.stringify(obj, null, 2);
    } else if (ep.samplePayload) {
      body = ep.samplePayload;
    }

    loadPostmanRequest({
      method: ep.method,
      url,
      body,
      headers: [{ key: 'Content-Type', val: 'application/json' }],
    });
    setActiveTab('postman');
  };

  const handleCopyAll = () => {
    let text = '';
    if (activeTab === 'endpoints')      text = (analysisData?.endpoints || []).map((e: any) => `[${e.method}] ${resolveUrl(e)}`).join('\n');
    else if (activeTab === 'secrets')   text = (analysisData?.secrets   || []).map((s: any) => `[${s.severity}] ${s.type}: ${s.value}`).join('\n');
    else if (activeTab === 'headers')   text = (analysisData?.headers   || []).join('\n');
    else if (activeTab === 'payloads')  text = (analysisData?.payloads  || []).map((p: any) => p.key).join('\n');
    else if (activeTab === 'firebase')  text = (analysisData?.firebase  || []).join('\n');
    else if (activeTab === 'deeplinks') text = (analysisData?.deeplinks || []).map((d: any) => d.url).join('\n');
    else if (activeTab === 'network')   text = [
      ...(analysisData?.ips || []).map((i: any) => i.ip),
      ...(analysisData?.websockets || [])
    ].join('\n');
    else if (activeTab === 'graphql')   text = (analysisData?.graphql || []).map((g: any) => `${g.kind} ${g.name}`).join('\n');

    if (text) copyText(text);
    else showToast(t('common.empty'), 'info');
  };

  const handleExport = async (format: 'json' | 'csv' | 'markdown') => {
    const name = (analysisData?.fileName || 'apk').replace('.apk', '').replace('.xapk', '');
    let content = '';

    if (format === 'json') {
      content = JSON.stringify({
        file: analysisData.fileName,
        analyzedAt: new Date().toISOString(),
        techStack: analysisData.techStack,
        architectures: analysisData.architectures,
        buildDate: analysisData.buildDate,
        riskScore: analysisData.riskScore,
        riskLevel: analysisData.riskLevel,
        manifest: analysisData.manifest,
        endpoints: analysisData.endpoints,
        payloads: analysisData.payloads,
        secrets: analysisData.secrets,
        headers: analysisData.headers,
        firebase: analysisData.firebase,
        deeplinks: analysisData.deeplinks,
        websockets: analysisData.websockets,
        ips: analysisData.ips,
        graphql: analysisData.graphql,
        stats: analysisData.stats,
      }, null, 2);
    } else if (format === 'csv') {
      const rows = [['Method', 'URL', 'Type', 'Confidence']];
      (analysisData?.endpoints || []).forEach((ep: any) => {
        rows.push([ep.method, resolveUrl(ep), ep.type, ep.confidence || '']);
      });
      content = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    } else {
      const lines = [
        `# APK Analysis — ${analysisData.fileName}`,
        `> ${new Date().toLocaleString()}`,
        '',
        `**Package:** \`${pkg}\``,
        `**Version:** ${version}`,
        `**Tech stack:** ${analysisData.techStack?.primary || '–'}`,
        `**Risk score:** ${analysisData.riskScore || 0}/100 (${analysisData.riskLevel || 'low'})`,
        '',
        `## Endpoints (${analysisData.endpoints?.length || 0})`,
        '',
        '| Method | URL |',
        '|--------|-----|',
        ...((analysisData?.endpoints || []).map((ep: any) => `| \`${ep.method}\` | \`${resolveUrl(ep)}\` |`)),
      ];
      content = lines.join('\n');
    }

    const saved = await window.electronAPI.saveFile({ defaultName: `${name}_analysis`, content, format });
    if (saved) showToast(t('common.save'), 'success');
  };

  const query = searchQuery.toLowerCase();

  const filteredEndpoints = (analysisData?.endpoints || []).filter((ep: any) => {
    const matchesQuery = !query || ep.url.toLowerCase().includes(query);
    const matchesMethod = activeMethod === 'ALL' || ep.method === activeMethod;
    const matchesConfidence = endpointConfFilter === 'all' || ep.confidence === endpointConfFilter;
    return matchesQuery && matchesMethod && matchesConfidence;
  });

  const filteredPayloads = (analysisData?.payloads || []).filter((p: any) => !query || p.key.toLowerCase().includes(query));
  const filteredSecrets = (analysisData?.secrets || []).filter((s: any) =>
    !query || s.value.toLowerCase().includes(query) || s.type.toLowerCase().includes(query));
  const filteredHeaders = (analysisData?.headers || []).filter((h: string) => !query || h.toLowerCase().includes(query));
  const filteredFirebase = (analysisData?.firebase || []).filter((f: string) => !query || f.toLowerCase().includes(query));
  const filteredDeeplinks = (analysisData?.deeplinks || []).filter((d: any) => !query || d.url.toLowerCase().includes(query));
  const filteredIps = (analysisData?.ips || []).filter((i: any) => !query || i.ip.toLowerCase().includes(query));
  const filteredWs = (analysisData?.websockets || []).filter((w: string) => !query || w.toLowerCase().includes(query));
  const filteredGraphql = (analysisData?.graphql || []).filter((g: any) => !query || g.name.toLowerCase().includes(query));

  const allStrings = analysisData?.allStrings || [];
  const filteredAllStrings = query ? allStrings.filter((s: string) => s.toLowerCase().includes(query)) : allStrings;
  const totalPages = Math.max(1, Math.ceil(filteredAllStrings.length / allStringsPerPage));
  const pagedAllStrings = filteredAllStrings.slice((allStringsPage - 1) * allStringsPerPage, allStringsPage * allStringsPerPage);

  const riskScore = analysisData?.riskScore || 0;
  const riskLevel = analysisData?.riskLevel || 'low';

  const riskColorMap: Record<string, string> = {
    critical: '#ff453a',
    high:     '#ff9f0a',
    medium:   '#ffd60a',
    low:      '#30d158',
  };
  const riskColor = riskColorMap[riskLevel] || '#30d158';

  const navGroups = [
    {
      title: t('side.dashboard'),
      items: [{ key: 'overview', Icon: LayoutDashboard, label: t('tab.overview'), count: null as number | null }],
    },
    {
      title: t('side.discovery'),
      items: [
        { key: 'endpoints',  Icon: Compass,  label: t('tab.endpoints'),  count: analysisData?.endpoints?.length || 0 },
        { key: 'payloads',   Icon: Code,     label: t('tab.payloads'),   count: analysisData?.payloads?.length  || 0 },
        { key: 'headers',    Icon: ListTodo, label: t('tab.headers'),    count: analysisData?.headers?.length   || 0 },
        { key: 'deeplinks',  Icon: Link2,    label: t('tab.deeplinks'),  count: analysisData?.deeplinks?.length || 0 },
        { key: 'network',    Icon: Network,  label: t('tab.network'),    count: (analysisData?.ips?.length || 0) + (analysisData?.websockets?.length || 0) },
        { key: 'graphql',    Icon: Hash,     label: t('tab.graphql'),    count: analysisData?.graphql?.length   || 0 },
      ],
    },
    {
      title: t('side.security'),
      items: [
        { key: 'secrets',    Icon: KeyRound, label: t('tab.secrets'),    count: analysisData?.secrets?.length || 0 },
        { key: 'manifest',   Icon: Shield,   label: t('tab.manifest'),   count: analysisData?.manifest?.permissions?.length || 0 },
      ],
    },
    {
      title: t('side.data'),
      items: [
        { key: 'firebase',   Icon: Database, label: t('tab.firebase'),   count: analysisData?.firebase?.length || 0 },
        { key: 'allstrings', Icon: FileCode, label: t('tab.allstrings'), count: allStrings.length },
      ],
    },
    {
      title: t('side.tools'),
      items: [
        { key: 'postman',    Icon: Sparkles, label: t('tab.postman'),    count: null as number | null },
        { key: 'ai',         Icon: Sparkles, label: t('tab.ai'),         count: null as number | null },
      ],
    },
    {
      title: t('side.about'),
      items: [{ key: 'developer', Icon: User, label: t('tab.developer'), count: null as number | null }],
    },
  ];

  const showSearchBar = !['overview', 'developer', 'ai', 'postman', 'manifest'].includes(activeTab);
  const showBaseUrl = ['endpoints', 'allstrings'].includes(activeTab);
  const currentLang = LANGS.find(l => l.code === lang);

  return (
    <div className="flex-1 flex h-full overflow-hidden animate-fade-in">

      {/* SIDEBAR */}
      <aside
        className={`mac-sidebar flex flex-col h-full flex-shrink-0 transition-all duration-200 ${
          sidebarCollapsed ? 'w-14' : 'w-60'
        }`}
      >
        {/* Sidebar header */}
        <div className="p-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setScreen('welcome')}
              className="btn btn-ghost p-1.5"
              title={t('common.home')}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="btn btn-ghost p-1.5"
              title="Toggle"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="mt-3 surface-2 rounded-lg p-2.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary flex-shrink-0">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] font-medium text-default truncate mono" title={pkg}>{pkg}</span>
                  <span className="text-[9px] text-muted truncate">{version}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 risk-meter">
                  <div style={{ width: `${riskScore}%`, background: riskColor }} />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: riskColor }}>{riskScore}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-2.5">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-0.5">
              {!sidebarCollapsed && <span className="side-label">{group.title}</span>}
              {group.items.map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`tab-btn ${isActive ? 'active' : ''}`}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <item.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.count !== null && (
                          <span className={`text-[10px] ${isActive ? 'text-primary-light' : 'text-muted'}`}>
                            {(item.count as number).toLocaleString()}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Export footer */}
        {!sidebarCollapsed && (
          <div className="p-2 border-t border-white/[0.06]">
            <span className="side-label">{t('common.export')}</span>
            <div className="grid grid-cols-3 gap-1">
              {(['json', 'csv', 'markdown'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className="btn btn-secondary text-[10px] py-1.5"
                >
                  {fmt === 'markdown' ? 'MD' : fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">

        {/* Topbar */}
        <div className="h-12 mac-topbar flex items-center justify-between px-4 flex-shrink-0 drag-region">
          <div className="flex items-center gap-2 no-drag flex-1 min-w-0">
            {showSearchBar && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3 h-3 text-muted" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search')}
                  className="input search-input w-56 text-xs"
                />
              </div>
            )}

            {showBaseUrl && (
              <div className="flex items-center gap-2 surface-2 rounded-md px-2 py-1">
                <span className="text-[9px] font-semibold text-muted uppercase">Base URL</span>
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="bg-transparent border-none text-xs text-default mono outline-none w-48"
                />
                {suggestedUrls.length > 0 && (
                  <div className="flex gap-1 border-l border-white/[0.06] pl-2">
                    {suggestedUrls.slice(0, 2).map((url, uIdx) => (
                      <button
                        key={uIdx}
                        onClick={() => setCustomBaseUrl(url)}
                        className="text-[9px] font-semibold bg-primary/10 border border-primary/20 text-primary-light hover:bg-primary hover:text-white transition-colors rounded px-1.5 py-0.5"
                      >
                        {url.replace(/^https?:\/\//, '')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 no-drag">
            {activeTab === 'endpoints' && (
              <div className="segment">
                {['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                  <button
                    key={m}
                    onClick={() => setActiveMethod(m)}
                    className={activeMethod === m ? 'active' : ''}
                  >
                    {m === 'ALL' ? t('common.all') : m}
                  </button>
                ))}
              </div>
            )}

            {showSearchBar && (
              <button onClick={handleCopyAll} className="btn btn-secondary text-xs">
                <Copy className="w-3 h-3" />
                {t('common.copy')}
              </button>
            )}

            {/* Lang switcher (mini) */}
            <div className="relative">
              <button onClick={() => setLangOpen(!langOpen)} className="btn btn-ghost text-xs px-2 py-1.5">
                {currentLang?.flag} <span className="ml-1 uppercase">{currentLang?.code}</span>
              </button>
              {langOpen && (
                <div className="absolute top-full right-0 mt-1 w-36 surface rounded-lg overflow-hidden z-30 animate-scale-in shadow-xl" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {activeTab === 'overview' && <OverviewPanel data={analysisData} t={t} setActiveTab={setActiveTab} />}

          {/* ENDPOINTS */}
          {activeTab === 'endpoints' && (
            <div className="flex flex-col gap-4 max-w-6xl">
              <SectionHeader title={t('ep.heading')} desc={t('ep.sub')} count={filteredEndpoints.length} />

              <div className="segment w-fit">
                {[
                  { key: 'all',    label: t('common.all') },
                  { key: 'high',   label: t('ep.high') },
                  { key: 'medium', label: t('ep.medium') },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setEndpointConfFilter(opt.key as any)}
                    className={endpointConfFilter === opt.key ? 'active' : ''}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {filteredEndpoints.length === 0 ? (
                <EmptyState Icon={Compass} text={t('ep.empty')} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredEndpoints.map((ep: any, idx: number) => {
                    const isExpanded = expandedCard === idx;
                    const methodCls = METHOD_CLASS[ep.method] || 'method-post';
                    const resolved = resolveUrl(ep);

                    return (
                      <div key={idx} className={`card ${isExpanded ? 'border-primary/30' : ''}`}>
                        <div
                          onClick={() => setExpandedCard(isExpanded ? null : idx)}
                          className="p-3 flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded uppercase ${methodCls}`}>
                              {ep.method}
                            </span>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs mono text-default truncate">{resolved}</span>
                              {ep.type === 'relative_path' && resolved !== ep.url && (
                                <span className="text-[10px] text-muted truncate mono mt-0.5">
                                  {t('ep.original')}: {ep.url}
                                </span>
                              )}
                            </div>
                            {ep.confidence === 'high' && (
                              <span className="pill sev-low">HIGH</span>
                            )}
                          </div>
                          <ChevronRight className={`w-3.5 h-3.5 text-muted flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>

                        {isExpanded && (
                          <div className="p-3 border-t border-white/[0.06] flex flex-col gap-3 animate-scale-in" onClick={(e) => e.stopPropagation()}>
                            {ep.queryParams && ep.queryParams.length > 0 && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{t('ep.query')}</span>
                                <div className="flex flex-wrap gap-1">
                                  {ep.queryParams.map((p: any, pIdx: number) => (
                                    <span key={pIdx} className="text-[10px] surface-2 rounded px-2 py-0.5 text-soft mono">
                                      {p.key}=<span className="text-primary-light">{p.value}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {ep.inferredPayloadKeys?.length > 0 && ['POST', 'PUT', 'PATCH'].includes(ep.method) && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{t('ep.inferredPayload')}</span>
                                <div className="flex flex-wrap gap-1">
                                  {ep.inferredPayloadKeys.map((k: string, kIdx: number) => (
                                    <span key={kIdx} className="text-[10px] bg-primary/10 border border-primary/20 rounded px-2 py-0.5 text-primary-light mono">
                                      {k}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                              <button onClick={() => copyText(resolved)} className="btn btn-ghost text-xs">
                                <Copy className="w-3 h-3" />
                                URL
                              </button>
                              <button onClick={() => openInTester(ep)} className="btn btn-primary text-xs">
                                <Sparkles className="w-3 h-3" />
                                {t('ep.openTester')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PAYLOADS */}
          {activeTab === 'payloads' && (
            <div className="flex flex-col gap-4 max-w-6xl">
              <SectionHeader title={t('mod.payloads')} desc={t('mod.payloads.d')} count={filteredPayloads.length} />
              {filteredPayloads.length === 0 ? (
                <EmptyState Icon={Code} text={t('common.empty')} />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  <div className="grid grid-cols-2 gap-1.5">
                    {filteredPayloads.map((p: any, idx: number) => (
                      <div key={idx} onClick={() => copyText(p.key)} className="card p-2.5 cursor-pointer">
                        <span className="text-xs mono font-medium text-default truncate block">"{p.key}"</span>
                        <span className="text-[9px] text-primary-light font-semibold uppercase tracking-wider">{p.type}</span>
                      </div>
                    ))}
                  </div>
                  <div className="surface rounded-lg p-4 sticky top-0">
                    <div className="flex items-center gap-2 mb-3">
                      <FileJson className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-semibold text-muted uppercase">Sample JSON</span>
                    </div>
                    <pre className="code-block selectable whitespace-pre-wrap">
                      {(() => {
                        const obj: Record<string, any> = {};
                        filteredPayloads.slice(0, 12).forEach((p: any) => {
                          if (p.type.startsWith('integer')) obj[p.key] = 1;
                          else if (p.type.startsWith('boolean')) obj[p.key] = true;
                          else if (p.type.startsWith('number')) obj[p.key] = 0;
                          else if (p.type.includes('email')) obj[p.key] = 'user@example.com';
                          else if (p.type.includes('password')) obj[p.key] = '••••••••';
                          else if (p.type.includes('token')) obj[p.key] = '<token>';
                          else obj[p.key] = '<string>';
                        });
                        return JSON.stringify(obj, null, 2);
                      })()}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECRETS */}
          {activeTab === 'secrets' && (
            <div className="flex flex-col gap-4 max-w-5xl">
              <SectionHeader title={t('sec.heading')} desc={t('sec.sub')} count={filteredSecrets.length} />
              {filteredSecrets.length === 0 ? (
                <EmptyState Icon={KeyRound} text={t('sec.empty')} />
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredSecrets.map((s: any, idx: number) => {
                    const visible = showSecretValue[idx];
                    return (
                      <div key={idx} className="card p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded uppercase ${SEV_COLORS[s.severity || 'medium']}`}>
                              {t(`risk.${s.severity || 'medium'}`)}
                            </span>
                            <span className="text-[11px] font-medium text-default">{s.type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowSecretValue(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              className="btn btn-ghost text-[10px] p-1.5"
                            >
                              {visible ? t('common.hide') : t('common.show')}
                            </button>
                            <button onClick={() => copyText(s.value)} className="btn btn-ghost text-[10px] p-1.5">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs mono text-default break-all surface-2 p-2.5 rounded-md selectable">
                          {visible ? s.value : '•'.repeat(Math.min(50, s.value.length))}
                        </div>
                        {s.source && (
                          <div className="text-[10px] text-muted truncate selectable">
                            {t('sec.source')}: <span className="text-soft mono">{s.source}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HEADERS */}
          {activeTab === 'headers' && (
            <div className="flex flex-col gap-4 max-w-5xl">
              <SectionHeader title={t('mod.headers')} desc={t('mod.headers.d')} count={filteredHeaders.length} />
              {filteredHeaders.length === 0 ? (
                <EmptyState Icon={ListTodo} text={t('common.empty')} />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {filteredHeaders.map((h: string, idx: number) => (
                    <div key={idx} onClick={() => copyText(h)} className="text-xs mono surface-2 hover:bg-white/[0.06] rounded-md px-3 py-1.5 text-soft cursor-pointer transition-colors">
                      {h}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MANIFEST */}
          {activeTab === 'manifest' && <ManifestPanel data={analysisData} t={t} />}

          {/* FIREBASE */}
          {activeTab === 'firebase' && (
            <div className="flex flex-col gap-4 max-w-5xl">
              <SectionHeader title={t('mod.firebase')} desc={t('mod.firebase.d')} count={filteredFirebase.length} />
              {filteredFirebase.length === 0 ? (
                <EmptyState Icon={Database} text={t('common.empty')} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredFirebase.map((url: string, idx: number) => (
                    <div key={idx} onClick={() => copyText(url)} className="text-xs mono card p-3 cursor-pointer break-all selectable">{url}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DEEPLINKS */}
          {activeTab === 'deeplinks' && (
            <div className="flex flex-col gap-4 max-w-5xl">
              <SectionHeader title={t('dl.heading')} desc={t('dl.sub')} count={filteredDeeplinks.length} />
              {filteredDeeplinks.length === 0 ? (
                <EmptyState Icon={Link2} text={t('dl.empty')} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredDeeplinks.map((d: any, idx: number) => (
                    <div key={idx} onClick={() => copyText(d.url)} className="card p-3 cursor-pointer flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-semibold bg-primary/10 border border-primary/20 text-primary-light px-2 py-0.5 rounded uppercase">{d.scheme}</span>
                        <span className="text-xs mono text-default truncate">{d.url}</span>
                      </div>
                      {d.source === 'manifest' && (
                        <span className="pill sev-low">MANIFEST</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NETWORK */}
          {activeTab === 'network' && (
            <div className="flex flex-col gap-4 max-w-5xl">
              <SectionHeader title={t('nw.heading')} desc={t('nw.sub')} count={filteredIps.length + filteredWs.length} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold text-muted uppercase">{t('nw.ips')} ({filteredIps.length})</span>
                  {filteredIps.length === 0 ? (
                    <EmptyState Icon={Globe} text={t('nw.emptyIp')} mini />
                  ) : (
                    <div className="flex flex-col gap-1">
                      {filteredIps.map((ip: any, idx: number) => (
                        <div key={idx} onClick={() => copyText(ip.ip)} className="card p-2.5 cursor-pointer flex items-center justify-between">
                          <span className="text-xs mono text-default selectable">{ip.ip}</span>
                          <span className={`pill ${ip.type === 'private' ? 'sev-high' : 'sev-low'}`}>
                            {ip.type === 'private' ? t('nw.private') : t('nw.public')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold text-muted uppercase">{t('nw.websockets')} ({filteredWs.length})</span>
                  {filteredWs.length === 0 ? (
                    <EmptyState Icon={Activity} text={t('nw.emptyWs')} mini />
                  ) : (
                    <div className="flex flex-col gap-1">
                      {filteredWs.map((w: string, idx: number) => (
                        <div key={idx} onClick={() => copyText(w)} className="card p-2.5 cursor-pointer mono text-xs text-default break-all selectable">{w}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GRAPHQL */}
          {activeTab === 'graphql' && (
            <div className="flex flex-col gap-4 max-w-5xl">
              <SectionHeader title={t('gql.heading')} desc={t('gql.sub')} count={filteredGraphql.length} />
              {filteredGraphql.length === 0 ? (
                <EmptyState Icon={Hash} text={t('gql.empty')} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {filteredGraphql.map((g: any, idx: number) => {
                    const colors: Record<string, string> = {
                      query:        'sev-low',
                      mutation:     'method-post',
                      subscription: 'method-patch',
                    };
                    return (
                      <div key={idx} onClick={() => copyText(`${g.kind} ${g.name}`)} className="card p-2.5 cursor-pointer flex items-center gap-2.5">
                        <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded uppercase ${colors[g.kind] || colors.query}`}>{g.kind}</span>
                        <span className="text-xs mono text-default selectable">{g.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ALL STRINGS */}
          {activeTab === 'allstrings' && (
            <div className="flex flex-col gap-4 max-w-6xl h-full">
              <SectionHeader title={t('tab.allstrings')} desc="DEX + native + arsc" count={filteredAllStrings.length} />
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-2">
                  {pagedAllStrings.map((str: string, sIdx: number) => (
                    <div key={sIdx} onClick={() => copyText(str)} className="card p-2.5 cursor-pointer mono text-xs text-default flex items-center justify-between">
                      <span className="break-all pr-3 selectable">{str}</span>
                      <span className="text-[10px] text-muted select-none flex-shrink-0">#{(allStringsPage - 1) * allStringsPerPage + sIdx + 1}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 py-3 border-t border-white/[0.06]">
                  <button disabled={allStringsPage === 1} onClick={() => setAllStringsPage(allStringsPage - 1)} className="btn btn-secondary text-xs">
                    ← {t('common.prev')}
                  </button>
                  <span className="text-xs text-soft">
                    {t('common.page')} <span className="text-default font-semibold">{allStringsPage}</span> / {totalPages}
                  </span>
                  <button disabled={allStringsPage === totalPages} onClick={() => setAllStringsPage(allStringsPage + 1)} className="btn btn-secondary text-xs">
                    {t('common.next')} →
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'postman'   && <Postman />}
          {activeTab === 'ai'        && <AiAnalysis />}
          {activeTab === 'developer' && <AboutDev />}
        </div>
      </main>
    </div>
  );
}

const SectionHeader: React.FC<{ title: string; desc: string; count?: number }> = ({ title, desc, count }) => (
  <div className="flex items-end justify-between">
    <div className="flex flex-col gap-1">
      <h3 className="text-base font-semibold text-default">{title}</h3>
      <span className="text-xs text-soft">{desc}</span>
    </div>
    {typeof count === 'number' && (
      <span className="pill bg-primary/10 border-primary/20 text-primary-light">
        {count.toLocaleString()}
      </span>
    )}
  </div>
);

const EmptyState: React.FC<{ Icon: any; text: string; mini?: boolean }> = ({ Icon, text, mini }) => (
  <div className={`flex flex-col items-center justify-center text-center border border-dashed border-white/[0.06] rounded-xl surface-2 ${mini ? 'py-8' : 'py-16'} gap-2`}>
    <Icon className={`text-muted ${mini ? 'w-6 h-6' : 'w-9 h-9'}`} />
    <span className={`text-soft ${mini ? 'text-xs' : 'text-sm'}`}>{text}</span>
  </div>
);

// ─── Overview Panel ─────────────────────────────────────────────────────────
const OverviewPanel: React.FC<{ data: any; t: (k: string) => string; setActiveTab: (t: string) => void }> = ({ data, t, setActiveTab }) => {
  const stats = data?.stats || {};
  const riskScore = data?.riskScore || 0;
  const riskLevel = data?.riskLevel || 'low';
  const permAnalysis = data?.permissionAnalysis;
  const topSecrets = (data?.secrets || []).slice(0, 5);
  const topEndpoints = (data?.endpoints || []).slice(0, 6);
  const techStack = data?.techStack;
  const architectures = data?.architectures || [];
  const buildDate = data?.buildDate;

  const riskColorMap: Record<string, string> = {
    critical: '#ff453a', high: '#ff9f0a', medium: '#ffd60a', low: '#30d158',
  };
  const riskColor = riskColorMap[riskLevel] || '#30d158';

  const techLabel = techStack?.primary ? t(`tech.${techStack.primary}`) : t('tech.unknown');

  const summaryCards = [
    { Icon: Compass,  label: t('tab.endpoints'),  value: stats.endpointsCount || 0, tab: 'endpoints' },
    { Icon: KeyRound, label: t('tab.secrets'),    value: stats.secretsCount   || 0, tab: 'secrets' },
    { Icon: Code,     label: t('tab.payloads'),   value: stats.payloadsCount  || 0, tab: 'payloads' },
    { Icon: ListTodo, label: t('tab.headers'),    value: stats.headersCount   || 0, tab: 'headers' },
    { Icon: Link2,    label: t('tab.deeplinks'),  value: stats.deeplinksCount || 0, tab: 'deeplinks' },
    { Icon: Network,  label: t('tab.network'),    value: (stats.ipsCount || 0) + (stats.websocketsCount || 0), tab: 'network' },
    { Icon: Hash,     label: t('tab.graphql'),    value: stats.graphqlCount   || 0, tab: 'graphql' },
    { Icon: Database, label: t('tab.firebase'),   value: (data?.firebase?.length) || 0, tab: 'firebase' },
  ];

  return (
    <div className="flex flex-col gap-4 max-w-6xl">

      {/* App overview card */}
      <div className="surface rounded-2xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">

          {/* Risk score circle */}
          <div className="md:col-span-3 flex items-center gap-4">
            <div className="relative w-20 h-20 flex items-center justify-center" style={{
              background: `conic-gradient(${riskColor} ${riskScore * 3.6}deg, rgba(255,255,255,0.06) 0)`,
              borderRadius: '50%',
            }}>
              <div className="absolute inset-1.5 bg-bg rounded-full flex flex-col items-center justify-center">
                <span className="text-xl font-semibold" style={{ color: riskColor }}>{riskScore}</span>
                <span className="text-[9px] text-muted uppercase">/100</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{t('ov.risk')}</span>
              <span className="text-base font-semibold" style={{ color: riskColor }}>{t(`risk.${riskLevel}`)}</span>
              <span className="text-[10px] text-muted mt-0.5 max-w-[160px]">
                {riskLevel === 'critical' && t('ov.riskCrit')}
                {riskLevel === 'high'     && t('ov.riskHigh')}
                {riskLevel === 'medium'   && t('ov.riskMed')}
                {riskLevel === 'low'      && t('ov.riskLow')}
              </span>
            </div>
          </div>

          <div className="md:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetaCell Icon={Layers}    label={t('ov.tech')}    value={techLabel} />
            <MetaCell Icon={Calendar}  label={t('ov.compiled')} value={buildDate?.date || t('common.never')} />
            <MetaCell Icon={Cpu}       label={t('ov.arch')}    value={architectures.length ? architectures.join(', ') : '–'} />
            <MetaCell Icon={Smartphone} label={t('ov.minSdk')}  value={data?.manifest?.minSdkVersion ? `API ${data.manifest.minSdkVersion}` : '–'} />
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2">
        {summaryCards.map((card, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(card.tab)}
            className="card p-3 text-left flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <card.Icon className="w-3.5 h-3.5 text-primary-light" />
            </div>
            <span className="text-xl font-semibold text-default">{card.value.toLocaleString()}</span>
            <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">{card.label}</span>
          </button>
        ))}
      </div>

      {/* Critical/high alert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <AlertCard Icon={AlertTriangle} label="Critical secrets" value={stats.criticalSecrets || 0} alert={stats.criticalSecrets > 0} />
        <AlertCard Icon={Lock} label="High secrets" value={stats.highSecrets || 0} alert={stats.highSecrets > 2} />
        <AlertCard Icon={FileText} label={t('an.strings')} value={(stats.totalStrings || 0).toLocaleString()} />
      </div>

      {/* Permissions + secrets */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 surface rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-default flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-primary" />
              {t('ov.permRisk')}
            </h3>
            <button onClick={() => setActiveTab('manifest')} className="btn btn-ghost text-[10px]">
              {t('ov.viewAll')} →
            </button>
          </div>
          {permAnalysis ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                {(['critical', 'high', 'medium', 'low'] as const).map(level => (
                  <div key={level} className="surface-2 rounded-lg p-2.5">
                    <span className="text-[9px] font-semibold text-muted uppercase tracking-wider">{t(`risk.${level}`)}</span>
                    <div className="text-lg font-semibold mt-0.5" style={{ color: riskColorMap[level] }}>
                      {permAnalysis.stats[level] || 0}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
                {(permAnalysis.enriched || []).slice(0, 8).map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-md surface-2">
                    <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded uppercase ${SEV_COLORS[p.level]}`}>
                      {t(`risk.${p.level}`)}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] mono text-default truncate">{p.name.replace('android.permission.', '')}</span>
                      <span className="text-[10px] text-muted truncate">{p.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState Icon={Shield} text={t('common.empty')} mini />
          )}
        </div>

        <div className="lg:col-span-2 surface rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-default flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-warning" />
              {t('ov.topSecrets')}
            </h3>
            <button onClick={() => setActiveTab('secrets')} className="btn btn-ghost text-[10px]">
              {t('ov.viewAll')} →
            </button>
          </div>
          {topSecrets.length === 0 ? (
            <EmptyState Icon={KeyRound} text={t('sec.empty')} mini />
          ) : (
            <div className="flex flex-col gap-1.5">
              {topSecrets.map((s: any, idx: number) => (
                <div key={idx} className="surface-2 rounded-md p-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded uppercase ${SEV_COLORS[s.severity]}`}>
                      {t(`risk.${s.severity}`)}
                    </span>
                    <span className="text-[10px] font-medium text-soft">{s.type}</span>
                  </div>
                  <span className="text-[10px] mono text-muted truncate block mt-0.5 selectable">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top endpoints */}
      <div className="surface rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-default flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-primary" />
            {t('ov.topEndpoints')}
          </h3>
          <button onClick={() => setActiveTab('endpoints')} className="btn btn-ghost text-[10px]">
            {t('ov.viewAll')} →
          </button>
        </div>
        {topEndpoints.length === 0 ? (
          <EmptyState Icon={Compass} text={t('ep.empty')} mini />
        ) : (
          <div className="flex flex-col gap-1">
            {topEndpoints.map((ep: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-md surface-2">
                <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded uppercase ${METHOD_CLASS[ep.method] || 'method-post'}`}>
                  {ep.method}
                </span>
                <span className="text-xs mono text-default truncate flex-1 selectable">{ep.url}</span>
                <ExternalLink className="w-3 h-3 text-muted flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MetaCell: React.FC<{ Icon: any; label: string; value: any }> = ({ Icon, label, value }) => (
  <div className="surface-2 rounded-lg p-2.5 flex flex-col gap-0.5">
    <div className="flex items-center gap-1.5 text-muted">
      <Icon className="w-3 h-3" />
      <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-[11px] font-medium text-default truncate">{value}</span>
  </div>
);

const AlertCard: React.FC<{ Icon: any; label: string; value: any; alert?: boolean }> = ({ Icon, label, value, alert }) => (
  <div className={`surface rounded-xl p-3 flex items-center gap-3 ${alert ? 'border-danger/30' : ''}`}>
    <div className={`p-2.5 rounded-lg ${alert ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex flex-col">
      <span className="text-xl font-semibold text-default">{value}</span>
      <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">{label}</span>
    </div>
  </div>
);

const ManifestPanel: React.FC<{ data: any; t: (k: string) => string }> = ({ data, t }) => {
  const manifest = data?.manifest;
  const permAnalysis = data?.permissionAnalysis;

  if (!manifest) return <EmptyState Icon={Shield} text={t('mf.empty')} />;

  const detailRows = [
    { label: t('mf.package'),    value: manifest.packageName || data?.fallbackPackageName || '–' },
    { label: t('mf.version'),    value: manifest.versionName ? `${manifest.versionName} (${manifest.versionCode || '–'})` : '–' },
    { label: t('ov.minSdk'),     value: manifest.minSdkVersion ? `API ${manifest.minSdkVersion}` : '–' },
    { label: t('ov.targetSdk'),  value: manifest.targetSdkVersion ? `API ${manifest.targetSdkVersion}` : '–' },
    { label: t('mf.activities'), value: (manifest.activities?.length || 0).toLocaleString() },
    { label: t('mf.services'),   value: (manifest.services?.length   || 0).toLocaleString() },
    { label: t('mf.receivers'),  value: (manifest.receivers?.length  || 0).toLocaleString() },
    { label: t('mf.providers'),  value: (manifest.providers?.length  || 0).toLocaleString() },
  ];

  const riskColorMap: Record<string, string> = {
    critical: '#ff453a', high: '#ff9f0a', medium: '#ffd60a', low: '#30d158',
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <SectionHeader title={t('mf.heading')} desc="" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="surface rounded-xl p-4">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block mb-3">{t('mf.appInfo')}</span>
          <div className="flex flex-col">
            {detailRows.map((row, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs py-2 border-b border-white/[0.04] last:border-b-0">
                <span className="text-soft">{row.label}</span>
                <span className="mono text-default selectable text-right max-w-[60%] truncate" title={row.value}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {permAnalysis && (
          <div className="surface rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{t('mf.riskDist')}</span>
              <span className="text-[10px] font-semibold text-default">Score: {permAnalysis.score}</span>
            </div>
            <div className="risk-meter mb-3" style={{ height: 6 }}>
              {(['critical', 'high', 'medium', 'low'] as const).map(level => {
                const total = (permAnalysis.enriched || []).length || 1;
                const pct = ((permAnalysis.stats[level] || 0) / total) * 100;
                return pct > 0 ? <div key={level} style={{ width: `${pct}%`, background: riskColorMap[level] }} title={`${level}: ${permAnalysis.stats[level]}`} /> : null;
              })}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['critical', 'high', 'medium', 'low'] as const).map(level => (
                <div key={level} className="flex flex-col items-center p-2 rounded-md surface-2">
                  <span className="text-base font-semibold" style={{ color: riskColorMap[level] }}>{permAnalysis.stats[level] || 0}</span>
                  <span className="text-[9px] text-muted uppercase tracking-wider font-semibold">{t(`risk.${level}`)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {permAnalysis?.enriched?.length > 0 && (
        <div className="surface rounded-xl p-4">
          <h4 className="text-sm font-semibold text-default mb-3">{t('mf.permissions')} ({permAnalysis.enriched.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[480px] overflow-y-auto">
            {permAnalysis.enriched.map((p: any, idx: number) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded-md surface-2">
                <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded uppercase flex-shrink-0 mt-0.5 ${SEV_COLORS[p.level]}`}>
                  {t(`risk.${p.level}`)}
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] mono text-default break-all">{p.name.replace('android.permission.', '')}</span>
                  <span className="text-[10px] text-muted mt-0.5">{p.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {manifest.activities?.length > 0 && (
        <div className="surface rounded-xl p-4">
          <h4 className="text-sm font-semibold text-default mb-3">{t('mf.activities')} ({manifest.activities.length})</h4>
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {manifest.activities.slice(0, 50).map((a: string, idx: number) => (
              <div key={idx} className="text-[11px] mono text-soft p-2 rounded-md surface-2 selectable break-all">{a}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

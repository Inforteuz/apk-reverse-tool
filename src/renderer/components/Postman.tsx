import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import {
  Send, Plus, Trash2, Save, History, Folder, Clock,
  Copy, KeyRound
} from 'lucide-react';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

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

export const Postman: React.FC = () => {
  const t = useAppStore(state => state.t);
  const current = useAppStore(state => state.postmanCurrent);
  const setCurrent = useAppStore(state => state.setPostmanCurrent);
  const response = useAppStore(state => state.postmanResponse);
  const setResponse = useAppStore(state => state.setPostmanResponse);
  const loading = useAppStore(state => state.postmanLoading);
  const setLoading = useAppStore(state => state.setPostmanLoading);
  const history = useAppStore(state => state.postmanHistory);
  const clearHistory = useAppStore(state => state.clearPostmanHistory);
  const addHistory = useAppStore(state => state.addPostmanHistory);
  const collections = useAppStore(state => state.postmanCollections);
  const saveCollection = useAppStore(state => state.savePostmanCollection);
  const removeCollection = useAppStore(state => state.removePostmanCollection);
  const loadPostmanRequest = useAppStore(state => state.loadPostmanRequest);

  const [activeSection, setActiveSection] = useState<'params' | 'headers' | 'body' | 'auth'>('headers');
  const [sidePanel, setSidePanel] = useState<'history' | 'collections'>('collections');
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const send = async () => {
    if (!current.url.trim()) {
      showToast('URL kerak', 'error');
      return;
    }

    let finalUrl = current.url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl.replace(/^\/+/, '');
    }

    // Build headers
    const headersObj: Record<string, string> = {};
    for (const h of current.headers) {
      if (h.key.trim()) headersObj[h.key.trim()] = h.val.trim();
    }
    if (current.auth.type === 'bearer' && current.auth.token) {
      headersObj['Authorization'] = `Bearer ${current.auth.token}`;
    } else if (current.auth.type === 'basic' && current.auth.username !== undefined) {
      const enc = btoa(`${current.auth.username}:${current.auth.password || ''}`);
      headersObj['Authorization'] = `Basic ${enc}`;
    }

    setLoading(true);
    setResponse(null);
    try {
      const res = await window.electronAPI.testRequest({
        method: current.method,
        url: finalUrl,
        headers: headersObj,
        body: current.body,
      });
      setResponse(res);
      addHistory({
        id: Date.now().toString(),
        method: current.method,
        url: finalUrl,
        status: res.status,
        duration: res.duration,
        ranAt: new Date().toLocaleString(),
      });
    } catch (e: any) {
      setResponse({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const updateHeader = (idx: number, field: 'key' | 'val', value: string) => {
    const list = [...current.headers];
    if (!list[idx]) list[idx] = { key: '', val: '' };
    list[idx][field] = value;
    setCurrent({ headers: list });
  };
  const addHeader = () => setCurrent({ headers: [...current.headers, { key: '', val: '' }] });
  const removeHeader = (idx: number) => {
    const list = [...current.headers];
    list.splice(idx, 1);
    setCurrent({ headers: list });
  };

  const handleSaveCollection = () => {
    if (!saveName.trim()) return;
    saveCollection({
      id: Date.now().toString(),
      name: saveName.trim(),
      method: current.method,
      url: current.url,
      headers: current.headers,
      body: current.body,
      savedAt: new Date().toLocaleString(),
    });
    setSaveName('');
    setShowSaveDialog(false);
    showToast('Saqlandi', 'success');
  };

  const responseBody = useMemo(() => {
    if (!response) return '';
    if (!response.success) return response.error || '';
    try { return JSON.stringify(JSON.parse(response.data), null, 2); }
    catch { return response.data || '<empty>'; }
  }, [response]);

  const responseSize = useMemo(() => {
    if (!response?.data) return '–';
    const bytes = new Blob([response.data]).size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }, [response]);

  const methodClass = (m: string) => {
    const map: Record<string, string> = {
      GET: 'method-get', POST: 'method-post', PUT: 'method-put',
      DELETE: 'method-delete', PATCH: 'method-patch'
    };
    return map[m] || 'method-post';
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-6">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-default">{t('pm.title')}</h3>
          <span className="text-xs text-soft">{t('pm.subtitle')}</span>
        </div>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="btn btn-secondary text-xs"
        >
          <Save className="w-3.5 h-3.5" />
          {t('pm.saveAs')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main request area */}
        <div className="lg:col-span-3 flex flex-col gap-3">

          {/* URL row */}
          <div className="surface rounded-xl p-3 flex gap-2">
            <select
              value={current.method}
              onChange={(e) => setCurrent({ method: e.target.value })}
              className={`select font-semibold ${methodClass(current.method)} w-24 text-center`}
            >
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              type="text"
              value={current.url}
              onChange={(e) => setCurrent({ url: e.target.value })}
              placeholder="https://api.example.com/route"
              className="input flex-1 mono text-xs"
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button
              onClick={send}
              disabled={loading}
              className="btn btn-primary text-xs px-5"
            >
              {loading ? (
                <div className="mac-spinner text-white"><div /><div /><div /><div /><div /><div /><div /><div /><div /><div /><div /><div /></div>
              ) : <Send className="w-3.5 h-3.5" />}
              {loading ? t('common.sending') : t('pm.send')}
            </button>
          </div>

          {/* Tabs */}
          <div className="surface rounded-xl overflow-hidden">
            <div className="flex border-b border-white/[0.06]">
              {(['headers', 'body', 'auth'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                    activeSection === s ? 'text-primary-light border-b-2 border-primary' : 'text-soft hover:text-default'
                  }`}
                >
                  {t(`pm.${s}`)}
                  {s === 'headers' && current.headers.length > 0 && (
                    <span className="ml-1.5 text-[10px] text-muted">({current.headers.length})</span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-3 min-h-[180px]">
              {activeSection === 'headers' && (
                <div className="flex flex-col gap-2">
                  {current.headers.map((h, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={h.key}
                        onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                        placeholder="Header name"
                        className="input mono flex-1 text-xs"
                      />
                      <input
                        type="text"
                        value={h.val}
                        onChange={(e) => updateHeader(idx, 'val', e.target.value)}
                        placeholder="Value"
                        className="input mono flex-1 text-xs"
                      />
                      <button onClick={() => removeHeader(idx)} className="btn btn-danger p-1.5">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={addHeader} className="btn btn-ghost text-xs w-fit">
                    <Plus className="w-3 h-3" />
                    {t('pm.addHeader')}
                  </button>
                </div>
              )}

              {activeSection === 'body' && (
                <textarea
                  value={current.body}
                  onChange={(e) => setCurrent({ body: e.target.value })}
                  placeholder="Request body (JSON, XML, ...)"
                  className="textarea w-full h-48 mono text-xs"
                />
              )}

              {activeSection === 'auth' && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    {(['none', 'bearer', 'basic'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setCurrent({ auth: { ...current.auth, type } })}
                        className={`btn text-xs ${current.auth.type === type ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {type === 'none'   ? t('pm.noAuth') : type === 'bearer' ? t('pm.bearerToken') : t('pm.basicAuth')}
                      </button>
                    ))}
                  </div>

                  {current.auth.type === 'bearer' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-semibold text-muted tracking-wider">{t('pm.bearerToken')}</label>
                      <input
                        type="text"
                        value={current.auth.token || ''}
                        onChange={(e) => setCurrent({ auth: { ...current.auth, token: e.target.value } })}
                        placeholder="eyJhbGciOiJIUzI1NiIs..."
                        className="input mono text-xs"
                      />
                    </div>
                  )}

                  {current.auth.type === 'basic' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase font-semibold text-muted tracking-wider">{t('pm.username')}</label>
                        <input
                          type="text"
                          value={current.auth.username || ''}
                          onChange={(e) => setCurrent({ auth: { ...current.auth, username: e.target.value } })}
                          className="input mono text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase font-semibold text-muted tracking-wider">{t('pm.password')}</label>
                        <input
                          type="password"
                          value={current.auth.password || ''}
                          onChange={(e) => setCurrent({ auth: { ...current.auth, password: e.target.value } })}
                          className="input mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Response */}
          {response && (
            <div className="surface rounded-xl overflow-hidden animate-scale-in">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-muted">{t('pm.status')}:</span>
                  <span className={`font-semibold ${
                    response.success && response.status && response.status >= 200 && response.status < 300 ? 'text-success' : 'text-danger'
                  }`}>
                    {response.success ? `${response.status} ${response.statusText || ''}` : 'FAILED'}
                  </span>
                  <span className="text-muted">{t('pm.time')}:</span>
                  <span className="text-default font-semibold">{response.duration ? `${response.duration} ms` : '–'}</span>
                  <span className="text-muted">{t('pm.size')}:</span>
                  <span className="text-default font-semibold">{responseSize}</span>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(responseBody); showToast(t('common.copied'), 'success'); }}
                  className="btn btn-ghost p-1.5"
                  title={t('common.copy')}
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <pre className="px-4 py-3 mono text-xs text-soft max-h-80 overflow-auto whitespace-pre-wrap selectable">
                {responseBody}
              </pre>
            </div>
          )}
        </div>

        {/* Side panel — Collections / History */}
        <div className="lg:col-span-1 surface rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
          <div className="segment m-2">
            <button
              onClick={() => setSidePanel('collections')}
              className={sidePanel === 'collections' ? 'active' : ''}
            >
              <Folder className="w-3 h-3 inline mr-1" />
              {t('pm.collections')}
            </button>
            <button
              onClick={() => setSidePanel('history')}
              className={sidePanel === 'history' ? 'active' : ''}
            >
              <History className="w-3 h-3 inline mr-1" />
              {t('pm.history')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {sidePanel === 'collections' ? (
              collections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
                  <Folder className="w-6 h-6" />
                  <span className="text-[11px]">{t('common.empty')}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {collections.map(c => (
                    <div
                      key={c.id}
                      className="group flex flex-col gap-1 p-2 rounded-lg surface-2 hover:bg-white/[0.06] cursor-pointer"
                      onClick={() => loadPostmanRequest({ method: c.method, url: c.url, body: c.body, headers: c.headers })}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-default truncate flex-1">{c.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeCollection(c.id); }}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded ${methodClass(c.method)}`}>{c.method}</span>
                        <span className="text-[10px] text-muted mono truncate">{c.url}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="btn btn-ghost text-[10px] w-full mb-1">
                    <Trash2 className="w-2.5 h-2.5" />
                    {t('common.delete')}
                  </button>
                )}
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
                    <Clock className="w-6 h-6" />
                    <span className="text-[11px]">{t('pm.noHistory')}</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {history.map(h => (
                      <div
                        key={h.id}
                        onClick={() => loadPostmanRequest({ method: h.method, url: h.url })}
                        className="flex flex-col gap-0.5 p-2 rounded-lg surface-2 hover:bg-white/[0.06] cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded ${methodClass(h.method)}`}>{h.method}</span>
                          <span className={`text-[9px] font-semibold ${
                            h.status && h.status >= 200 && h.status < 300 ? 'text-success' : 'text-danger'
                          }`}>{h.status || '?'}</span>
                          <span className="text-[10px] text-muted">{h.duration} ms</span>
                        </div>
                        <span className="text-[10px] text-soft mono truncate">{h.url}</span>
                        <span className="text-[9px] text-muted">{h.ranAt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowSaveDialog(false)}>
          <div className="surface rounded-xl p-5 max-w-sm w-full mx-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-default mb-3 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              {t('pm.saveAs')}
            </h4>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Request name"
              autoFocus
              className="input w-full text-sm mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCollection()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveDialog(false)} className="btn btn-ghost">
                {t('common.cancel')}
              </button>
              <button onClick={handleSaveCollection} disabled={!saveName.trim()} className="btn btn-primary">
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { useState } from 'react';
import { useAppStore } from '../store';
import { Sparkles, Settings2, KeyRound, Check, AlertCircle, Cpu, Shield, Zap } from 'lucide-react';

export const AiAnalysis: React.FC = () => {
  const t = useAppStore(state => state.t);
  const analysisData = useAppStore(state => state.analysisData);
  const aiSettings = useAppStore(state => state.aiSettings);
  const setAiSettings = useAppStore(state => state.setAiSettings);
  const aiAnalysisText = useAppStore(state => state.aiAnalysisText);
  const setAiAnalysisText = useAppStore(state => state.setAiAnalysisText);
  const aiLoading = useAppStore(state => state.aiLoading);
  const setAiLoading = useAppStore(state => state.setAiLoading);

  const [showConfig, setShowConfig] = useState(!aiSettings.apiKey);
  const [apiKeyInput, setApiKeyInput] = useState(aiSettings.apiKey);
  const [providerInput, setProviderInput] = useState(aiSettings.provider);
  const [modelInput, setModelInput] = useState(aiSettings.model);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [errorText, setErrorText] = useState('');

  const saveConfig = () => {
    setAiSettings({ apiKey: apiKeyInput, provider: providerInput, model: modelInput });
    setShowConfig(false);
    setErrorText('');
  };

  const handleStartAnalysis = async () => {
    if (!aiSettings.apiKey) {
      setShowConfig(true);
      setErrorText('API key required');
      return;
    }

    setAiLoading(true);
    setErrorText('');
    setAiAnalysisText('');

    try {
      const pkg = analysisData?.manifest?.packageName || analysisData?.fallbackPackageName || '—';
      const perms = (analysisData?.manifest?.permissions || []).join(', ') || 'none';
      const endpointsSample = (analysisData?.endpoints || []).slice(0, 30).map((ep: any) => `[${ep.method}] ${ep.url}`).join('\n');
      const secretsSample = (analysisData?.secrets || []).map((s: any) => `${s.type} (${s.severity}): ${s.value}`).join('\n');
      const tech = analysisData?.techStack?.primary || 'unknown';

      const prompt = `You are a professional Android security engineer.

App: ${analysisData?.fileName}
Package: ${pkg}
Tech stack: ${tech}
Risk score: ${analysisData?.riskScore || 0}/100 (${analysisData?.riskLevel || 'low'})

Permissions: ${perms}

Endpoints (sample):
${endpointsSample || 'none'}

Secrets:
${secretsSample || 'none'}

Analyze in 4 sections (in Uzbek): 1. What the app does; 2. Security analysis; 3. Attack vectors; 4. Engineering recommendations.`;

      let apiUrl = '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiSettings.apiKey}`,
      };

      if (aiSettings.provider === 'openrouter') {
        apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        headers['HTTP-Referer'] = 'https://inforte.uz';
        headers['X-Title'] = 'APK Reverse Tool';
      } else if (aiSettings.provider === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
      } else {
        apiUrl = customEndpoint || 'https://openrouter.ai/api/v1/chat/completions';
      }

      const body = {
        model: aiSettings.model || 'meta-llama/llama-3-8b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
      };

      const result = await window.electronAPI.testRequest({
        method: 'POST', url: apiUrl, headers, body: JSON.stringify(body),
      });

      if (result.success && result.data) {
        const responseData = JSON.parse(result.data);
        const choice = responseData?.choices?.[0];
        const content = choice?.message?.content || choice?.text || '';
        setAiAnalysisText(content || '—');
      } else {
        throw new Error(result.error || `Status ${result.status}`);
      }
    } catch (e: any) {
      setErrorText(`AI error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl animate-fade-in pb-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-default">{t('ai.title')}</h3>
          <span className="text-xs text-soft">{t('ai.sub')}</span>
        </div>
        <button onClick={() => setShowConfig(!showConfig)} className="btn btn-secondary text-xs">
          <Settings2 className="w-3 h-3" />
          Settings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {[
          { Icon: Cpu,    title: 'App purpose',  desc: 'Backend architecture' },
          { Icon: Shield, title: 'Security',     desc: 'Vulnerabilities' },
          { Icon: Zap,    title: 'Suggestions',  desc: 'How to fix' },
        ].map((f, idx) => (
          <div key={idx} className="surface-2 rounded-lg p-2.5 flex items-start gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary flex-shrink-0">
              <f.Icon className="w-3 h-3" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-default">{f.title}</span>
              <span className="text-[10px] text-muted">{f.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {showConfig && (
        <div className="surface rounded-xl p-4 animate-scale-in flex flex-col gap-3">
          <h4 className="text-xs font-semibold text-default flex items-center gap-2">
            <KeyRound className="w-3 h-3 text-primary" />
            AI Provider
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Provider</label>
              <select value={providerInput} onChange={(e) => setProviderInput(e.target.value)} className="select text-xs">
                <option value="openrouter">OpenRouter (recommended)</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Model</label>
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="meta-llama/llama-3-8b-instruct:free"
                className="input mono text-xs"
              />
            </div>

            {providerInput === 'custom' && (
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Endpoint</label>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="https://api.../chat/completions"
                  className="input mono text-xs"
                />
              </div>
            )}

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                className="input mono text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowConfig(false)} className="btn btn-ghost text-xs">{t('common.cancel')}</button>
            <button onClick={saveConfig} className="btn btn-primary text-xs">
              <Check className="w-3 h-3" />
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {errorText && (
        <div className="surface rounded-lg p-3 flex gap-2 items-start animate-scale-in" style={{ borderLeft: '3px solid #ff453a' }}>
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <span className="text-xs text-danger">{errorText}</span>
        </div>
      )}

      <div className="surface rounded-xl p-5 min-h-[260px] flex flex-col">
        {aiLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
            <div className="mac-spinner lg text-primary">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} />)}
            </div>
            <span className="text-xs text-soft">AI is analyzing...</span>
          </div>
        ) : aiAnalysisText ? (
          <div className="text-xs text-soft leading-relaxed whitespace-pre-wrap selectable">
            <div className="flex items-center gap-2 mb-4 border-b border-white/[0.06] pb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-default text-sm">AI Analysis</span>
            </div>
            {aiAnalysisText}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="p-3 surface-2 rounded-xl text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <span className="text-sm font-medium text-default">AI-powered insights</span>
              <span className="text-xs text-soft">Get a structured security analysis of this APK in Uzbek.</span>
            </div>
            <button onClick={handleStartAnalysis} className="btn btn-primary mt-2">
              <Zap className="w-3.5 h-3.5" />
              {t('ai.start')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

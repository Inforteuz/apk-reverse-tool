import { create } from 'zustand';
import { DICTS, Lang } from './i18n';

interface Progress {
  percent: number;
  message: string;
}

interface AiSettings {
  apiKey: string;
  provider: string;
  model: string;
}

interface PostmanCollectionItem {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: { key: string; val: string }[];
  body: string;
  savedAt: string;
}

interface PostmanHistoryItem {
  id: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  ranAt: string;
}

interface AppState {
  currentScreen: 'welcome' | 'analyzing' | 'results';
  selectedFile: string | null;
  analysisData: any | null;
  progress: Progress;
  activeTab: string;
  searchQuery: string;
  activeMethod: string;
  customBaseUrl: string;
  history: any[];
  aiSettings: AiSettings;
  aiAnalysisText: string;
  aiLoading: boolean;
  lang: Lang;

  // Postman tester state
  postmanCurrent: {
    method: string;
    url: string;
    headers: { key: string; val: string }[];
    body: string;
    auth: { type: 'none' | 'bearer' | 'basic'; token?: string; username?: string; password?: string };
  };
  postmanResponse: any;
  postmanLoading: boolean;
  postmanHistory: PostmanHistoryItem[];
  postmanCollections: PostmanCollectionItem[];

  // JADX All Strings Pagination
  allStringsPage: number;
  allStringsPerPage: number;

  // Actions
  setScreen: (screen: 'welcome' | 'analyzing' | 'results') => void;
  setSelectedFile: (file: string | null) => void;
  setAnalysisData: (data: any | null) => void;
  setProgress: (progress: Progress) => void;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  setActiveMethod: (method: string) => void;
  setCustomBaseUrl: (url: string) => void;
  setHistory: (history: any[]) => void;
  setAiSettings: (settings: Partial<AiSettings>) => void;
  setAiAnalysisText: (text: string) => void;
  setAiLoading: (loading: boolean) => void;
  setAllStringsPage: (page: number) => void;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;

  // Postman
  setPostmanCurrent: (patch: Partial<AppState['postmanCurrent']>) => void;
  loadPostmanRequest: (req: { method: string; url: string; body?: string; headers?: { key: string; val: string }[] }) => void;
  setPostmanResponse: (resp: any) => void;
  setPostmanLoading: (loading: boolean) => void;
  addPostmanHistory: (item: PostmanHistoryItem) => void;
  clearPostmanHistory: () => void;
  savePostmanCollection: (item: PostmanCollectionItem) => void;
  removePostmanCollection: (id: string) => void;

  loadHistory: () => void;
  saveToHistory: (data: any) => void;
  deleteHistoryItem: (index: number) => void;
}

const HISTORY_KEY = 'apk_analyzer_scanned_history';
const AI_SETTINGS_KEY = 'apk_analyzer_ai_settings';
const LANG_KEY = 'apk_analyzer_lang';
const PM_HISTORY_KEY = 'apk_analyzer_pm_history';
const PM_COLLECTIONS_KEY = 'apk_analyzer_pm_collections';

function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY) as Lang | null;
    if (v === 'uz' || v === 'ru' || v === 'en') return v;
  } catch {}
  return 'uz';
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

const defaultAiSettings: AiSettings = {
  apiKey: '',
  provider: 'openrouter',
  model: 'meta-llama/llama-3-8b-instruct:free',
};

export const useAppStore = create<AppState>((set, get) => ({
  currentScreen: 'welcome',
  selectedFile: null,
  analysisData: null,
  progress: { percent: 0, message: '' },
  activeTab: 'overview',
  searchQuery: '',
  activeMethod: 'ALL',
  customBaseUrl: '',
  history: [],
  aiSettings: (() => {
    try {
      const saved = localStorage.getItem(AI_SETTINGS_KEY);
      return saved ? { ...defaultAiSettings, ...JSON.parse(saved) } : defaultAiSettings;
    } catch {
      return defaultAiSettings;
    }
  })(),
  aiAnalysisText: '',
  aiLoading: false,
  lang: loadLang(),
  postmanCurrent: {
    method: 'GET',
    url: '',
    headers: [{ key: 'Content-Type', val: 'application/json' }],
    body: '',
    auth: { type: 'none' },
  },
  postmanResponse: null,
  postmanLoading: false,
  postmanHistory:    loadJson<PostmanHistoryItem[]>(PM_HISTORY_KEY, []),
  postmanCollections: loadJson<PostmanCollectionItem[]>(PM_COLLECTIONS_KEY, []),
  allStringsPage: 1,
  allStringsPerPage: 100,

  setScreen: (currentScreen) => set({ currentScreen }),
  setSelectedFile: (selectedFile) => set({ selectedFile }),
  setAnalysisData: (analysisData) => set({ analysisData, allStringsPage: 1 }),
  setProgress: (progress) => set({ progress }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSearchQuery: (searchQuery) => set({ searchQuery, allStringsPage: 1 }),
  setActiveMethod: (activeMethod) => set({ activeMethod }),
  setCustomBaseUrl: (customBaseUrl) => set({ customBaseUrl }),
  setHistory: (history) => set({ history }),
  setAiSettings: (settings) => set((state) => {
    const updated = { ...state.aiSettings, ...settings };
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(updated));
    return { aiSettings: updated };
  }),
  setAiAnalysisText: (aiAnalysisText) => set({ aiAnalysisText }),
  setAiLoading: (aiLoading) => set({ aiLoading }),
  setAllStringsPage: (allStringsPage) => set({ allStringsPage }),

  setLang: (lang) => {
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
    set({ lang });
  },
  t: (key) => {
    const lang = get().lang;
    return DICTS[lang]?.[key] ?? DICTS.uz[key] ?? key;
  },

  setPostmanCurrent: (patch) => set((s) => ({ postmanCurrent: { ...s.postmanCurrent, ...patch } })),
  loadPostmanRequest: ({ method, url, body, headers }) => set((s) => ({
    postmanCurrent: {
      ...s.postmanCurrent,
      method,
      url,
      body: body || '',
      headers: headers && headers.length ? headers : s.postmanCurrent.headers,
    },
    postmanResponse: null,
  })),
  setPostmanResponse: (postmanResponse) => set({ postmanResponse }),
  setPostmanLoading:  (postmanLoading)  => set({ postmanLoading }),
  addPostmanHistory: (item) => set((s) => {
    const list = [item, ...s.postmanHistory].slice(0, 50);
    try { localStorage.setItem(PM_HISTORY_KEY, JSON.stringify(list)); } catch {}
    return { postmanHistory: list };
  }),
  clearPostmanHistory: () => {
    try { localStorage.removeItem(PM_HISTORY_KEY); } catch {}
    set({ postmanHistory: [] });
  },
  savePostmanCollection: (item) => set((s) => {
    const filtered = s.postmanCollections.filter(c => c.id !== item.id);
    const list = [item, ...filtered].slice(0, 100);
    try { localStorage.setItem(PM_COLLECTIONS_KEY, JSON.stringify(list)); } catch {}
    return { postmanCollections: list };
  }),
  removePostmanCollection: (id) => set((s) => {
    const list = s.postmanCollections.filter(c => c.id !== id);
    try { localStorage.setItem(PM_COLLECTIONS_KEY, JSON.stringify(list)); } catch {}
    return { postmanCollections: list };
  }),

  loadHistory: () => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      set({ history: saved ? JSON.parse(saved) : [] });
    } catch {
      set({ history: [] });
    }
  },

  saveToHistory: (data) => {
    try {
      const history = get().history.filter(item => item.filePath !== data.filePath);
      const pkg = data.manifest?.packageName || data.fallbackPackageName || (data.apkMeta?.isXAPK ? 'XAPK split to\'plami' : 'Noma\'lum');
      
      const newItem = {
        fileName: data.fileName,
        filePath: data.filePath,
        fileSize: data.fileSize,
        packageName: pkg,
        versionName: data.manifest?.versionName || '',
        scannedAt: new Date().toLocaleString('uz-UZ'),
        results: data
      };

      const updated = [newItem, ...history].slice(0, 6);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      set({ history: updated });
    } catch (e) {
      console.error('Failed to save scan to history:', e);
    }
  },

  deleteHistoryItem: (index) => {
    try {
      const updated = [...get().history];
      updated.splice(index, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      set({ history: updated });
    } catch (e) {
      console.error('Failed to delete history item:', e);
    }
  }
}));

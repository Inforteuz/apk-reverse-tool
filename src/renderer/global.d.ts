interface ProgressData {
  message: string;
  percent: number;
}

interface TestRequestOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

interface TestRequestResult {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: string;
  duration?: number;
  error?: string;
}

interface SaveFileOptions {
  defaultName: string;
  content: string;
  format: 'json' | 'csv' | 'markdown';
}

interface AnalyzeOptions {
  endpoints?: boolean;
  payloads?: boolean;
  headers?: boolean;
  secrets?: boolean;
  manifest?: boolean;
  firebase?: boolean;
}

interface ElectronAPI {
  openAPKDialog: () => Promise<string | null>;
  saveFile: (opts: SaveFileOptions) => Promise<boolean>;
  showInFinder: (filePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  analyzeAPK: (filePath: string, options: AnalyzeOptions) => Promise<any>;
  testRequest: (reqOpts: TestRequestOptions) => Promise<TestRequestResult>;
  toggleDevTools: () => Promise<boolean>;
  onProgress: (callback: (data: ProgressData) => void) => () => void;
  platform: string;
}

interface Window {
  electronAPI: ElectronAPI;
}

// Electron extends File with .path (full filesystem path on drop)
interface File {
  path?: string;
}

declare module '*.css';

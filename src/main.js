// src/main.js
// Electron main process

'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');

const { parseAPK }           = require('./core/apk-parser');
const { parseAllDexStrings } = require('./core/dex-parser');
const { parseManifest, analyzePermissions } = require('./core/manifest-parser');
const { extractFromStrings } = require('./core/endpoint-extractor');
const { detectTechStack, detectArchitectures, detectBuildDate } = require('./core/apk-metadata');

let mainWindow = null;

// ─── Window creation ──────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          820,
    minWidth:        900,
    minHeight:       600,
    titleBarStyle:   'hiddenInset',
    vibrancy:        'under-window',
    visualEffectState: 'active',
    backgroundColor: '#070714',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false,
  });

  const isDev = process.argv.includes('--dev') || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  
  if (process.platform === 'darwin') {
    try {
      const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
      if (fs.existsSync(iconPath)) {
        app.dock.setIcon(iconPath);
      }
    } catch (e) {
      console.warn('Dock icon set failed:', e);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Package Fallback Extractor ───────────────────────────────────────────────

// System / library packages to skip during fallback detection
const SYSTEM_PACKAGE_PREFIXES = [
  'android.', 'androidx.', 'com.google.', 'com.android.', 'com.facebook.',
  'com.squareup.', 'com.jakewharton.', 'com.bumptech.', 'com.airbnb.',
  'com.fasterxml.', 'org.apache.', 'org.json.', 'org.jetbrains.',
  'org.intellij.', 'kotlin.', 'kotlinx.', 'java.', 'javax.', 'sun.',
  'io.flutter.', 'io.reactivex.', 'rx.', 'okhttp3.', 'retrofit2.',
  'dagger.', 'butterknife.', 'leakcanary.', 'timber.',
  'com.unity3d.', 'unity.', 'com.epicgames.',
  'com.crashlytics.', 'io.fabric.', 'com.appsflyer.', 'com.adjust.',
  'com.onesignal.', 'io.branch.', 'com.amplitude.', 'com.mixpanel.',
  'com.flurry.', 'com.tencent.', 'com.huawei.',
  'com.yandex.', 'ru.yandex.',
];

function isSystemPackage(pkg) {
  const lower = pkg.toLowerCase();
  return SYSTEM_PACKAGE_PREFIXES.some(p => lower.startsWith(p));
}

function extractFallbackPackageName(strings) {
  const packageCounts = {};
  // Match Lcom/example/app/MainActivity; or Luz/government/portal/HomeActivity;
  const regex = /^L([a-z]{2,5})\/([a-zA-Z0-9_]+\/)+[a-zA-Z0-9_$]+;$/;

  for (const str of strings) {
    if (regex.test(str)) {
      const parts = str.substring(1, str.length - 1).split('/');
      parts.pop(); // remove class name
      if (parts.length >= 2 && parts.length <= 6) {
        const pkg = parts.join('.');
        if (isSystemPackage(pkg)) continue;
        packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
      }
    }
  }

  // Take top 3, then prefer the one with .uz / .com TLD or shortest
  const sorted = Object.entries(packageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sorted.length === 0) return null;

  // If the top hit has 2x or more usage than the next, pick it
  if (sorted.length === 1 || sorted[0][1] >= sorted[1][1] * 2) {
    return sorted[0][0];
  }

  // Otherwise prefer shorter, country-tld-friendly packages
  const preferred = sorted.find(([pkg]) => {
    const segs = pkg.split('.');
    return segs.length >= 2 && segs.length <= 4;
  });

  return preferred ? preferred[0] : sorted[0][0];
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openAPK', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title:       'APK yoki XAPK faylni tanlang',
    buttonLabel: 'Tahlil qilish',
    filters:     [{ name: 'Android Package', extensions: ['apk', 'xapk'] }],
    properties:  ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (event, { defaultName, content, format }) => {
  const extMap = { json: 'json', csv: 'csv', markdown: 'md' };
  const ext = extMap[format] || 'txt';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Natijalarni saqlash',
    defaultPath: defaultName + '.' + ext,
    filters:     [{ name: 'Export', extensions: [ext] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('shell:showFile', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('shell:openExternal', async (event, url) => {
  shell.openExternal(url);
});

// Proxy HTTP requests to bypass CORS in UI (handles certificate bypass as well)
ipcMain.handle('api:testRequest', async (event, { method, url, headers, body }) => {
  try {
    const fetchOptions = {
      method: method || 'GET',
      headers: headers || {},
    };

    // Allow testing self-signed certificates or invalid SSL domains commonly used in development
    const processEnv = process.env;
    processEnv.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method)) {
      fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
      if (!fetchOptions.headers['Content-Type'] && !fetchOptions.headers['content-type']) {
        fetchOptions.headers['Content-Type'] = 'application/json';
      }
    }

    const start = Date.now();
    const res = await fetch(url, fetchOptions);
    const duration = Date.now() - start;

    const responseText = await res.text();
    
    const responseHeaders = {};
    res.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    return {
      success: true,
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      data: responseText,
      duration,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
});

// DevTools toggle handler
ipcMain.handle('dev:toggleTools', () => {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools();
    }
    return mainWindow.webContents.isDevToolsOpened();
  }
  return false;
});

// ─── Main tahlil IPC ──────────────────────────────────────────────────────────

ipcMain.handle('apk:analyze', async (event, { filePath, options }) => {
  const sendProgress = (message, percent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis:progress', { message, percent });
    }
  };

  try {
    sendProgress('Fayl o\'qilmoqda...', 2);

    const rawBuffer = fs.readFileSync(filePath);
    const fileBuffer = rawBuffer.buffer.slice(
      rawBuffer.byteOffset,
      rawBuffer.byteOffset + rawBuffer.byteLength
    );

    sendProgress('Fayl tarkibi tahlil qilinmoqda...', 5);

    // Parse APK or XAPK
    const apkData = await parseAPK(fileBuffer, sendProgress);

    sendProgress(`${apkData.dexFiles.length} ta DEX fayl topildi, stringlar o'qilmoqda...`, 80);

    // Extract all strings from DEX files
    const allStrings = parseAllDexStrings(apkData.dexFiles);

    // Combine DEX strings with native .so strings (for Flutter / Unity logic support)
    if (apkData.nativeStrings && apkData.nativeStrings.length > 0) {
      sendProgress(`DEX va ${apkData.nativeStrings.length} ta native string birlashtirilmoqda...`, 83);
      allStrings.push(...apkData.nativeStrings);
    }

    sendProgress(`${allStrings.length} ta string tahlil qilinmoqda...`, 85);

    // Parse manifest
    let manifestInfo = null;
    if (apkData.manifest && options.manifest !== false) {
      sendProgress('AndroidManifest.xml o\'qilmoqda...', 88);
      try {
        manifestInfo = parseManifest(apkData.manifest);
      } catch (e) {
        console.warn('[Main] Manifest parse failed:', e.message);
      }
    }

    // Extract package fallback name from class strings if manifest failed to provide one
    let fallbackPkg = null;
    if (!manifestInfo || !manifestInfo.packageName) {
      fallbackPkg = extractFallbackPackageName(allStrings);
    }

    sendProgress('API endpointlar qidirilmoqda...', 90);

    // Extract endpoints, secrets, etc.
    const extracted = extractFromStrings(allStrings, {
      endpoints: options.endpoints !== false,
      payloads:  options.payloads  !== false,
      headers:   options.headers   !== false,
      secrets:   options.secrets   !== false,
      firebase:  options.firebase  !== false,
    });

    // Add asset string hints
    if (apkData.assetContents && apkData.assetContents.length > 0) {
      sendProgress('Asset fayllar skanerlanmoqda...', 93);
      const assetStrings = apkData.assetContents.map(a => a.content).join('\n').split(/\s+/);
      const assetExtra = extractFromStrings(assetStrings, {
        endpoints: true, payloads: true, secrets: true
      });

      const existingUrls = new Set(extracted.endpoints.map(e => e.url));
      for (const ep of assetExtra.endpoints) {
        if (!existingUrls.has(ep.url)) {
          ep.source = 'asset';
          extracted.endpoints.push(ep);
          existingUrls.add(ep.url);
        }
      }
      const existingSecrets = new Set(extracted.secrets.map(s => s.value));
      for (const s of assetExtra.secrets) {
        if (!existingSecrets.has(s.value)) {
          extracted.secrets.push(s);
          existingSecrets.add(s.value);
        }
      }
    }

    sendProgress('Natijalar tayyorlanmoqda...', 98);

    const fileName = require('path').basename(filePath);

    // Merge manifest deep links + extracted deep links
    const manifestDeepLinks = (manifestInfo?.deepLinks || []).map(s => {
      const idx = s.indexOf('://');
      return idx > 0 ? { scheme: s.substring(0, idx), url: s, source: 'manifest' } : null;
    }).filter(Boolean);

    const seenDeep = new Set(extracted.deeplinks.map(d => d.url));
    for (const dl of manifestDeepLinks) {
      if (!seenDeep.has(dl.url)) {
        extracted.deeplinks.push(dl);
        seenDeep.add(dl.url);
      }
    }

    // Permission risk analysis
    let permissionAnalysis = null;
    if (manifestInfo?.permissions?.length) {
      permissionAnalysis = analyzePermissions(manifestInfo.permissions);
    }

    // Combined security risk score (manifest + secrets)
    const baseRisk = permissionAnalysis?.score || 0;
    const secretRisk = Math.min(60,
      (extracted.stats.criticalSecrets || 0) * 18 +
      (extracted.stats.highSecrets || 0) * 9
    );
    const riskScore = Math.min(100, Math.round(baseRisk * 0.55 + secretRisk * 0.9));
    let riskLevel = 'low';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 45) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'medium';

    // Tech stack + architecture + build date
    sendProgress('Texnologiya aniqlanmoqda...', 99);
    const techStack = detectTechStack(apkData.libFiles, apkData.assets, allStrings);
    const architectures = detectArchitectures(apkData.libFiles);
    const buildDate = detectBuildDate(apkData.assetContents || [], allStrings);

    return {
      success: true,
      fileName,
      filePath,
      fileSize:  rawBuffer.length,
      manifest:  manifestInfo,
      permissionAnalysis,
      riskScore,
      riskLevel,
      techStack,
      architectures,
      buildDate,
      fallbackPackageName: fallbackPkg,
      apkMeta:   apkData.metaInfo,
      assetFiles: apkData.assets,
      allStrings,
      ...extracted,
      stats: {
        ...extracted.stats,
        dexCount:       apkData.dexFiles.length,
        totalStrings:   allStrings.length,
        endpointsCount: extracted.endpoints.length,
        secretsCount:   extracted.secrets.length,
        headersCount:   extracted.headers.length,
        payloadsCount:  extracted.payloads.length,
        deeplinksCount: extracted.deeplinks.length,
        websocketsCount: extracted.websockets.length,
        ipsCount:       extracted.ips.length,
        graphqlCount:   extracted.graphql.length,
      }
    };
  } catch (err) {
    console.error('[Main] Analysis error:', err);
    return { success: false, error: err.message };
  }
});

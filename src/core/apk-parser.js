// src/core/apk-parser.js
// APK & XAPK file extractor — uses jszip to extract DEX + manifest + native .so strings (ASCII + UTF-16)
// Supports standard .apk and split-apk .xapk files

'use strict';

const JSZip = require('jszip');

/**
 * Load and extract APK or XAPK file contents
 * @param {Buffer} fileBuffer - raw APK or XAPK file buffer
 * @param {function} onProgress - progress callback (message, percent)
 * @returns {object} { dexFiles, manifest, assets, libFiles, nativeStrings, metaInfo }
 */
async function parseAPK(fileBuffer, onProgress = () => {}) {
  onProgress('Fayl ochilmoqda...', 5);

  let zip;
  try {
    zip = await JSZip.loadAsync(fileBuffer);
  } catch (e) {
    throw new Error(`Fayl ochilmadi (ZIP xatosi): ${e.message}`);
  }

  const fileNames = Object.keys(zip.files);
  const innerApkFiles = fileNames.filter(name => name.endsWith('.apk'));

  // ── XAPK / Split APK Detection ──────────────────────────────────────────
  if (innerApkFiles.length > 0) {
    onProgress(`XAPK aniqlandi. Ichida ${innerApkFiles.length} ta split APK bor.`, 10);
    return await parseXAPK(zip, innerApkFiles, onProgress);
  }

  // ── Standard APK Parsing ────────────────────────────────────────────────
  onProgress(`${fileNames.length} ta fayl topildi`, 10);
  return await parseSingleAPK(zip, onProgress);
}

/**
 * Parse a standard single APK file
 */
async function parseSingleAPK(zip, onProgress) {
  const fileNames = Object.keys(zip.files);
  const result = {
    dexFiles:      [],
    manifest:      null,
    assets:        [],
    libFiles:      [],
    resFiles:      [],
    nativeStrings: [],
    assetContents: [],
    metaInfo:    {
      totalFiles: fileNames.length,
      dexCount:   0,
      hasNativeLibs: false,
      hasAssets: false,
      isXAPK: false,
    }
  };

  const dexEntries = [];
  const soEntries = [];
  
  // Case-insensitive search for AndroidManifest.xml
  let manifestEntryName = null;
  for (const name of fileNames) {
    if (name.toLowerCase() === 'androidmanifest.xml') {
      manifestEntryName = name;
      break;
    }
  }

  const arscEntries = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    if (name.endsWith('.dex')) {
      dexEntries.push({ name, entry });
    } else if (name.startsWith('lib/')) {
      result.libFiles.push(name);
      result.metaInfo.hasNativeLibs = true;

      const lowerName = name.toLowerCase();
      if (lowerName.endsWith('libapp.so') || lowerName.endsWith('libil2cpp.so')
          || lowerName.endsWith('libmain.so') || lowerName.endsWith('libreact_nativemodule_core.so')
          || lowerName.endsWith('libhermes.so') || lowerName.endsWith('libflutter.so')) {
        soEntries.push({ name, entry });
      }
    } else if (name.startsWith('assets/')) {
      result.assets.push(name);
      result.metaInfo.hasAssets = true;
    } else if (name.startsWith('res/')) {
      result.resFiles.push(name);
    } else if (name === 'resources.arsc') {
      arscEntries.push({ name, entry });
    }
  }

  result.metaInfo.dexCount = dexEntries.length;

  // Extract Manifest
  if (manifestEntryName) {
    onProgress('AndroidManifest.xml tahlil qilinmoqda...', 15);
    try {
      result.manifest = await zip.files[manifestEntryName].async('arraybuffer');
    } catch (e) {
      console.warn('[APK Parser] Manifest parsing failed:', e.message);
    }
  }

  // Extract DEX files
  const totalDex = dexEntries.length;
  for (let i = 0; i < totalDex; i++) {
    const { name, entry } = dexEntries[i];
    const percent = 20 + Math.floor((i / totalDex) * 45);
    onProgress(`DEX fayl o'qilmoqda: ${name} (${i + 1}/${totalDex})`, percent);

    try {
      const dexBuffer = await entry.async('arraybuffer');
      result.dexFiles.push({ name, buffer: dexBuffer });
    } catch (e) {
      console.warn(`[APK Parser] Failed to extract ${name}:`, e.message);
    }
  }

  // Extract Native .so Strings (Flutter/Unity support)
  const totalSo = soEntries.length;
  for (let i = 0; i < totalSo; i++) {
    const { name, entry } = soEntries[i];
    const percent = 65 + Math.floor((i / totalSo) * 15);
    onProgress(`Native kutubxona tahlili: ${name.split('/').pop()}`, percent);

    try {
      const soBuffer = await entry.async('arraybuffer');
      const extracted = extractStringsFromBinary(soBuffer);
      result.nativeStrings.push(...extracted);
    } catch (e) {
      console.warn(`[APK Parser] Failed to parse .so ${name}:`, e.message);
    }
  }

  // Extract Assets (txt, json, xml properties)
  const interestingAssets = result.assets.filter(a =>
    a.endsWith('.json') || a.endsWith('.xml') ||
    a.endsWith('.txt')  || a.endsWith('.properties') ||
    a.endsWith('.conf') || a.endsWith('.yaml') || a.endsWith('.yml')
  );

  for (const assetName of interestingAssets.slice(0, 20)) {
    try {
      const content = await zip.files[assetName].async('string');
      result.assetContents.push({ name: assetName, content });
    } catch (e) {}
  }

  // Extract META-INF/MANIFEST.MF for build date hints
  for (const name of fileNames) {
    if (name.toUpperCase() === 'META-INF/MANIFEST.MF') {
      try {
        const content = await zip.files[name].async('string');
        result.assetContents.push({ name, content });
      } catch (e) {}
      break;
    }
  }

  // Extract strings from resources.arsc — often has URLs and config
  for (const { name, entry } of arscEntries) {
    onProgress('resources.arsc tahlil qilinmoqda...', 86);
    try {
      const arscBuffer = await entry.async('arraybuffer');
      const extracted = extractStringsFromBinary(arscBuffer);
      result.nativeStrings.push(...extracted);
    } catch (e) {
      console.warn(`[APK Parser] Failed to parse ${name}:`, e.message);
    }
  }

  return result;
}

/**
 * Parse XAPK (Split APKs combined in a single zip)
 */
async function parseXAPK(parentZip, innerApkFiles, onProgress) {
  const result = {
    dexFiles:      [],
    manifest:      null,
    assets:        [],
    libFiles:      [],
    resFiles:      [],
    nativeStrings: [],
    assetContents: [],
    metaInfo:    {
      totalFiles: 0,
      dexCount:   0,
      hasNativeLibs: false,
      hasAssets: false,
      isXAPK: true,
      splitCount: innerApkFiles.length,
    }
  };

  const totalApks = innerApkFiles.length;
  const soEntries = [];
  
  for (let idx = 0; idx < totalApks; idx++) {
    const apkName = innerApkFiles[idx];
    const progressBase = 10 + Math.floor((idx / totalApks) * 60);
    onProgress(`Split APK yuklanmoqda: ${apkName} (${idx + 1}/${totalApks})`, progressBase);

    try {
      const apkBuffer = await parentZip.files[apkName].async('nodebuffer');
      const innerZip = await JSZip.loadAsync(apkBuffer);
      const innerFileNames = Object.keys(innerZip.files);
      
      result.metaInfo.totalFiles += innerFileNames.length;

      for (const [name, entry] of Object.entries(innerZip.files)) {
        if (entry.dir) continue;

        if (name.endsWith('.dex')) {
          const dexBuffer = await entry.async('arraybuffer');
          result.dexFiles.push({ name: `${apkName}:${name}`, buffer: dexBuffer });
        } else if (name.startsWith('lib/')) {
          result.libFiles.push(name);
          result.metaInfo.hasNativeLibs = true;
          
          const lowerName = name.toLowerCase();
          if (lowerName.endsWith('libapp.so') || lowerName.endsWith('libil2cpp.so') || lowerName.endsWith('libmain.so')) {
            soEntries.push({ name: `${apkName}:${name}`, entry });
          }
        } else if (name.startsWith('assets/')) {
          result.assets.push(name);
          result.metaInfo.hasAssets = true;
          
          if (name.endsWith('.json') || name.endsWith('.xml') || name.endsWith('.txt') || name.endsWith('.properties')) {
            try {
              const content = await entry.async('string');
              result.assetContents.push({ name: `${apkName}:${name}`, content });
            } catch (e) {}
          }
        } else if (name.startsWith('res/')) {
          result.resFiles.push(name);
        } else if (name.toLowerCase() === 'androidmanifest.xml' && !result.manifest) {
          result.manifest = await entry.async('arraybuffer');
        } else if (name === 'resources.arsc') {
          try {
            const arscBuffer = await entry.async('arraybuffer');
            const extracted = extractStringsFromBinary(arscBuffer);
            result.nativeStrings.push(...extracted);
          } catch (e) {}
        } else if (name.toUpperCase() === 'META-INF/MANIFEST.MF') {
          try {
            const content = await entry.async('string');
            result.assetContents.push({ name: `${apkName}:${name}`, content });
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn(`[XAPK Parser] Error parsing split APK ${apkName}:`, e.message);
    }
  }

  // Parse Native SO for XAPKs
  const totalSo = soEntries.length;
  for (let i = 0; i < totalSo; i++) {
    const { name, entry } = soEntries[i];
    const percent = 70 + Math.floor((i / totalSo) * 15);
    onProgress(`Native kutubxona tahlili: ${name.split('/').pop()}`, percent);

    try {
      const soBuffer = await entry.async('arraybuffer');
      const extracted = extractStringsFromBinary(soBuffer);
      result.nativeStrings.push(...extracted);
    } catch (e) {
      console.warn(`[XAPK Parser] Failed to parse .so ${name}:`, e.message);
    }
  }

  result.metaInfo.dexCount = result.dexFiles.length;
  onProgress(`XAPK tahlili yakunlanmoqda (Jami ${result.dexFiles.length} ta DEX)...`, 90);

  return result;
}

/**
 * Extract printable ASCII and UTF-16 LE strings (length >= 5) from binary data
 */
function extractStringsFromBinary(buffer) {
  const u8 = new Uint8Array(buffer);
  const strings = [];
  const len = u8.length;
  
  // 1. Extract standard ASCII strings
  let start = -1;
  for (let i = 0; i < len; i++) {
    const c = u8[i];
    const isPrintable = (c >= 32 && c <= 126);
    if (isPrintable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1) {
        const strLen = i - start;
        if (strLen >= 5 && strLen < 300) {
          try {
            const slice = u8.subarray(start, i);
            const str = new TextDecoder('utf-8').decode(slice).trim();
            if (str.length >= 5 && /[a-zA-Z]/.test(str)) {
              strings.push(str);
            }
          } catch (e) {}
        }
        start = -1;
      }
    }
  }

  // 2. Extract UTF-16 LE strings (common in C++ binaries on little-endian)
  start = -1;
  for (let i = 0; i < len - 1; i += 2) {
    const c1 = u8[i];
    const c2 = u8[i+1];
    const isPrintable = (c1 >= 32 && c1 <= 126) && (c2 === 0x00);

    if (isPrintable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1) {
        const strLen = (i - start) / 2;
        if (strLen >= 5 && strLen < 300) {
          try {
            const slice = u8.subarray(start, i);
            const str = new TextDecoder('utf-16le').decode(slice).trim();
            if (str.length >= 5 && /[a-zA-Z]/.test(str)) {
              strings.push(str);
            }
          } catch (e) {}
        }
        start = -1;
      }
    }
  }

  // 3. Extract UTF-16 BE (occasionally appears in serialized data / Java strings)
  start = -1;
  for (let i = 0; i < len - 1; i += 2) {
    const c1 = u8[i];
    const c2 = u8[i+1];
    const isPrintable = (c1 === 0x00) && (c2 >= 32 && c2 <= 126);

    if (isPrintable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1) {
        const strLen = (i - start) / 2;
        if (strLen >= 6 && strLen < 300) {
          try {
            const slice = u8.subarray(start, i);
            const str = new TextDecoder('utf-16be').decode(slice).trim();
            if (str.length >= 6 && /[a-zA-Z]/.test(str)) {
              strings.push(str);
            }
          } catch (e) {}
        }
        start = -1;
      }
    }
  }

  return [...new Set(strings)];
}

module.exports = { parseAPK };

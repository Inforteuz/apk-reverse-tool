// src/core/apk-metadata.js
// Tech-stack, architecture, build-date detection for parsed APK contents.

'use strict';

// ─── Tech stack detector ─────────────────────────────────────────────────
// Looks at libFiles, assets and file names to infer framework.

function detectTechStack(libFiles = [], assets = [], allStrings = []) {
  const libs = libFiles.map(f => f.toLowerCase());
  const assetSet = new Set(assets.map(a => a.toLowerCase()));
  const hasLib = (name) => libs.some(l => l.endsWith(name) || l.includes('/' + name));

  const candidates = [];

  // Flutter
  if (hasLib('libflutter.so') || hasLib('libapp.so') || assetSet.has('flutter_assets')) {
    candidates.push({ tech: 'flutter', confidence: 'high' });
  }
  // React Native
  if (hasLib('libreactnativejni.so') || hasLib('libreact_nativemodule_core.so')
      || hasLib('libhermes.so') || hasLib('libjsc.so')
      || [...assetSet].some(a => a.includes('index.android.bundle'))) {
    candidates.push({ tech: 'reactnative', confidence: 'high' });
  }
  // Unity
  if (hasLib('libunity.so') || hasLib('libil2cpp.so') || hasLib('libmain.so') || hasLib('libmono.so')) {
    candidates.push({ tech: 'unity', confidence: 'high' });
  }
  // Xamarin
  if (hasLib('libmonodroid.so') || hasLib('libxamarin-app.so') || hasLib('libmono-android-debug.so')) {
    candidates.push({ tech: 'xamarin', confidence: 'high' });
  }
  // NativeScript
  if (hasLib('libnativescript.so') || [...assetSet].some(a => a.includes('nativescript'))) {
    candidates.push({ tech: 'nativescript', confidence: 'high' });
  }
  // Cordova / Ionic
  if ([...assetSet].some(a => a.includes('cordova.js') || a.includes('www/index.html') || a.includes('ionic'))) {
    candidates.push({ tech: 'cordova', confidence: 'high' });
  }
  // Kotlin (heuristic via strings)
  if (allStrings.some(s => s.startsWith('kotlin/') || s.includes('Lkotlin/') || s.includes('kotlin.Metadata'))) {
    candidates.push({ tech: 'kotlin', confidence: 'medium' });
  }

  if (candidates.length === 0) {
    return { primary: 'native', confidence: 'medium', all: ['native'] };
  }

  // Prefer high confidence
  const high = candidates.filter(c => c.confidence === 'high');
  const primary = (high[0] || candidates[0]).tech;
  return {
    primary,
    confidence: (high[0] || candidates[0]).confidence,
    all: candidates.map(c => c.tech),
  };
}

// ─── Architecture detection ──────────────────────────────────────────────
// Look at lib/<arch>/ paths

function detectArchitectures(libFiles = []) {
  const archs = new Set();
  for (const f of libFiles) {
    const m = f.match(/^lib\/([^/]+)\//);
    if (m) archs.add(m[1]);
  }
  return [...archs];
}

// ─── Build / compile date detection ──────────────────────────────────────
// Heuristics:
// 1. Look in META-INF MANIFEST.MF (Built-By, Build-Time)
// 2. Look at gradle build date strings
// 3. Take latest "build" string year
// 4. Fall back to file modification time

function detectBuildDate(assetContents = [], allStrings = []) {
  // 1. META-INF/MANIFEST.MF entries we have
  for (const a of assetContents) {
    const content = a.content || '';
    const buildTime = content.match(/Build-Time:\s*([^\r\n]+)/i);
    if (buildTime) return { date: buildTime[1].trim(), source: 'MANIFEST.MF' };
    const built = content.match(/Built-On:\s*([^\r\n]+)/i);
    if (built) return { date: built[1].trim(), source: 'MANIFEST.MF' };
  }

  // 2. Look for ISO timestamps in strings — pick the most recent
  const isoRegex = /\b(20[12][0-9]-[01][0-9]-[0-3][0-9])(?:[T ][0-2][0-9]:[0-5][0-9](?::[0-5][0-9])?)?\b/g;
  const dates = new Set();

  // Only check sample of strings (perf)
  const sample = allStrings.slice(0, 5000);
  for (const s of sample) {
    if (s.length > 200) continue;
    const matches = s.match(isoRegex);
    if (matches) {
      for (const m of matches) dates.add(m.slice(0, 10));
    }
  }

  const sorted = [...dates].sort().reverse();
  if (sorted.length > 0) return { date: sorted[0], source: 'strings' };

  return { date: null, source: null };
}

module.exports = { detectTechStack, detectArchitectures, detectBuildDate };

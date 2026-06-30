// src/core/manifest-parser.js
// Android Binary XML (AXML) parser for AndroidManifest.xml
// Extracts: package, version, permissions, activities, services, deep links

'use strict';

// AXML chunk types
const RES_STRING_POOL_TYPE       = 0x0001;
const RES_XML_TYPE               = 0x0003;
const RES_XML_START_ELEMENT      = 0x0102;

// String pool flags
const UTF8_FLAG = 1 << 8;

/**
 * Parse Android string pool chunk
 */
function parseStringPool(buffer, offset) {
  const view = new DataView(buffer);

  const chunkType   = view.getUint16(offset, true);
  const headerSize  = view.getUint16(offset + 2, true);
  const chunkSize   = view.getUint32(offset + 4, true);
  const stringCount = view.getUint32(offset + 8, true);
  const flags       = view.getUint32(offset + 16, true);
  const stringsStart = view.getUint32(offset + 20, true);

  const isUTF8 = (flags & UTF8_FLAG) !== 0;
  const strings = [];

  const offsetsBase = offset + headerSize;

  for (let i = 0; i < stringCount; i++) {
    const strOffset = view.getUint32(offsetsBase + i * 4, true);
    const strBase   = offset + stringsStart + strOffset;

    try {
      let str;
      if (isUTF8) {
        let pos = strBase;
        const u8 = new Uint8Array(buffer);
        let utf16Len = u8[pos++];
        if (utf16Len & 0x80) { utf16Len = ((utf16Len & 0x7F) << 8) | u8[pos++]; }
        let utf8Len = u8[pos++];
        if (utf8Len & 0x80) { utf8Len = ((utf8Len & 0x7F) << 8) | u8[pos++]; }
        const bytes = u8.slice(pos, pos + utf8Len);
        str = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      } else {
        let pos = strBase;
        const d = new DataView(buffer);
        let len = d.getUint16(pos, true); pos += 2;
        if (len & 0x8000) {
          len = ((len & 0x7FFF) << 16) | d.getUint16(pos, true); pos += 2;
        }
        const chars = [];
        for (let j = 0; j < len; j++) {
          chars.push(d.getUint16(pos + j * 2, true));
        }
        str = String.fromCharCode(...chars);
      }
      strings.push(str);
    } catch (e) {
      strings.push('');
    }
  }

  return { strings, chunkSize };
}

/**
 * Get attribute value as string
 */
function getAttrValue(view, attrBase, strings) {
  const nameIdx    = view.getInt32(attrBase + 4, true);  // attribute name string index
  const valueIdx   = view.getInt32(attrBase + 12, true); // raw value string index
  const dataType   = view.getUint8(attrBase + 15);
  const data       = view.getInt32(attrBase + 16, true);

  const name = (nameIdx >= 0 && nameIdx < strings.length) ? strings[nameIdx] : '';
  let value = '';

  if (valueIdx >= 0 && valueIdx < strings.length && strings[valueIdx]) {
    value = strings[valueIdx];
  } else {
    switch (dataType) {
      case 0x10: value = String(data); break;
      case 0x11: value = '0x' + data.toString(16); break;
      case 0x12: value = data !== 0 ? 'true' : 'false'; break;
      default:   value = String(data);
    }
  }

  return { name, value };
}

/**
 * Main AXML parser
 * @param {ArrayBuffer} buffer - AndroidManifest.xml binary content
 * @returns {object} parsed manifest info
 */
function parseManifest(buffer) {
  const view = new DataView(buffer);
  const result = {
    packageName:  '',
    versionName:  '',
    versionCode:  '',
    minSdkVersion: '',
    targetSdkVersion: '',
    permissions:  [],
    activities:   [],
    services:     [],
    receivers:    [],
    providers:    [],
    deepLinks:    [],
    raw: {}
  };

  if (buffer.byteLength < 8) return result;

  const fileType = view.getUint16(0, true);
  if (fileType !== RES_XML_TYPE) {
    return fallbackStringExtract(buffer);
  }

  let offset = 8; // skip file header
  let strings = [];

  while (offset < buffer.byteLength - 4) {
    const chunkType  = view.getUint16(offset, true);
    const headerSize = view.getUint16(offset + 2, true);
    const chunkSize  = view.getUint32(offset + 4, true);

    if (chunkSize === 0 || chunkSize > buffer.byteLength) break;

    if (chunkType === RES_STRING_POOL_TYPE) {
      const sp = parseStringPool(buffer, offset);
      strings = sp.strings;
    } else if (chunkType === RES_XML_START_ELEMENT) {
      const elemNameIdx = view.getInt32(offset + 20, true);
      const elemName = (elemNameIdx >= 0 && elemNameIdx < strings.length) ? strings[elemNameIdx] : '';

      const attrStart  = view.getUint16(offset + 26, true);
      const attrCount  = view.getUint16(offset + 28, true);
      const attrSize   = view.getUint16(offset + 30, true) || 20;

      const attrs = {};
      for (let a = 0; a < attrCount; a++) {
        const attrBase = offset + headerSize + attrStart - headerSize + a * attrSize;
        if (attrBase + 20 > buffer.byteLength) break;
        try {
          const { name, value } = getAttrValue(view, attrBase, strings);
          if (name) attrs[name] = value;
        } catch (e) {}
      }

      switch (elemName) {
        case 'manifest':
          if (attrs['package'])     result.packageName  = attrs['package'];
          if (attrs['versionName']) result.versionName  = attrs['versionName'];
          if (attrs['versionCode']) result.versionCode  = attrs['versionCode'];
          break;

        case 'uses-permission':
          if (attrs['name']) {
            result.permissions.push(attrs['name']);
          }
          break;

        case 'activity':
          if (attrs['name']) result.activities.push(attrs['name']);
          break;

        case 'service':
          if (attrs['name']) result.services.push(attrs['name']);
          break;

        case 'receiver':
          if (attrs['name']) result.receivers.push(attrs['name']);
          break;

        case 'provider':
          if (attrs['name']) result.providers.push(attrs['name']);
          break;

        case 'data':
          if (attrs['scheme'] && attrs['host']) {
            result.deepLinks.push(`${attrs['scheme']}://${attrs['host']}${attrs['path'] || attrs['pathPattern'] || ''}`);
          } else if (attrs['scheme']) {
            result.deepLinks.push(`${attrs['scheme']}://`);
          }
          break;

        case 'uses-sdk':
          if (attrs['minSdkVersion'])    result.minSdkVersion    = attrs['minSdkVersion'];
          if (attrs['targetSdkVersion']) result.targetSdkVersion = attrs['targetSdkVersion'];
          break;
      }
    }

    offset += chunkSize;
  }

  // Double check: if elements parsing returned empty package, search string pool as fallback
  if (!result.packageName && strings.length > 0) {
    const pkgPattern = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,5}$/;
    for (const s of strings) {
      if (pkgPattern.test(s) && !isLibraryPackage(s)) {
        result.packageName = s;
        break;
      }
    }
  }

  // Sanity check: reject obvious library package as packageName
  if (result.packageName && isLibraryPackage(result.packageName)) {
    result.packageName = '';
  }

  return result;
}

function isLibraryPackage(pkg) {
  const lower = pkg.toLowerCase();
  const libPrefixes = [
    'android.', 'androidx.', 'com.google.', 'com.android.',
    'com.facebook.', 'io.flutter.', 'kotlin.', 'kotlinx.',
    'java.', 'javax.', 'org.apache.', 'org.json.', 'org.jetbrains.',
    'com.squareup.', 'com.bumptech.', 'okhttp3.', 'retrofit2.',
    'rx.', 'io.reactivex.', 'dagger.', 'butterknife.',
  ];
  return libPrefixes.some(p => lower.startsWith(p)) || lower.includes('schema');
}

/**
 * Fallback: extract strings directly from AXML binary for partial info
 */
function fallbackStringExtract(buffer) {
  const u8 = new Uint8Array(buffer);
  const result = {
    packageName: '',
    versionName: '',
    permissions: [],
    activities: [],
    services: [],
    receivers: [],
    providers: [],
    deepLinks: [],
    fallback: true
  };

  const strings = [];
  let i = 0;
  while (i < u8.length - 2) {
    if (u8[i] >= 32 && u8[i] < 127) {
      let s = '';
      let j = i;
      while (j < u8.length && u8[j] >= 32 && u8[j] < 127) {
        s += String.fromCharCode(u8[j++]);
      }
      if (s.length >= 4) strings.push(s);
      i = j;
    } else {
      i++;
    }
  }

  const pkgPattern = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,5}$/;

  for (const s of strings) {
    if (s.startsWith('android.permission.')) result.permissions.push(s);
    else if (s.includes('.activity.') || s.endsWith('Activity')) result.activities.push(s);
    else if (s.includes('.service.') || s.endsWith('Service')) result.services.push(s);

    if (!result.packageName && pkgPattern.test(s) && !isLibraryPackage(s)) {
      result.packageName = s;
    }
  }

  return result;
}

// ─── Permission risk catalog ─────────────────────────────────────────────────

const PERMISSION_RISK = {
  // Critical / Dangerous
  'android.permission.READ_SMS':                 { level: 'critical', desc: 'SMS xabarlarini o\'qish' },
  'android.permission.SEND_SMS':                 { level: 'critical', desc: 'SMS yuborish (to\'lov xavfi)' },
  'android.permission.RECEIVE_SMS':              { level: 'critical', desc: 'Kiruvchi SMS\'larni qabul qilish' },
  'android.permission.READ_CONTACTS':            { level: 'high',     desc: 'Kontaktlarni o\'qish' },
  'android.permission.WRITE_CONTACTS':           { level: 'high',     desc: 'Kontaktlarni o\'zgartirish' },
  'android.permission.READ_CALL_LOG':            { level: 'critical', desc: 'Qo\'ng\'iroq jurnalini o\'qish' },
  'android.permission.WRITE_CALL_LOG':           { level: 'high',     desc: 'Qo\'ng\'iroq jurnaliga yozish' },
  'android.permission.CALL_PHONE':               { level: 'high',     desc: 'Avtomatik qo\'ng\'iroq qilish' },
  'android.permission.READ_PHONE_STATE':         { level: 'high',     desc: 'IMEI, telefon raqami va holatini o\'qish' },
  'android.permission.ACCESS_FINE_LOCATION':     { level: 'critical', desc: 'GPS aniq joylashuv' },
  'android.permission.ACCESS_COARSE_LOCATION':   { level: 'high',     desc: 'Taxminiy joylashuv' },
  'android.permission.ACCESS_BACKGROUND_LOCATION':{ level: 'critical', desc: 'Fonda joylashuv kuzatuvi' },
  'android.permission.CAMERA':                   { level: 'high',     desc: 'Kameraga kirish' },
  'android.permission.RECORD_AUDIO':             { level: 'high',     desc: 'Mikrofondan yozib olish' },
  'android.permission.READ_EXTERNAL_STORAGE':    { level: 'medium',   desc: 'Tashqi xotirani o\'qish' },
  'android.permission.WRITE_EXTERNAL_STORAGE':   { level: 'medium',   desc: 'Tashqi xotiraga yozish' },
  'android.permission.MANAGE_EXTERNAL_STORAGE':  { level: 'critical', desc: 'Barcha fayllarga kirish' },
  'android.permission.READ_MEDIA_IMAGES':        { level: 'medium',   desc: 'Foydalanuvchi rasmlarini o\'qish' },
  'android.permission.READ_MEDIA_VIDEO':         { level: 'medium',   desc: 'Foydalanuvchi videolarini o\'qish' },
  'android.permission.READ_MEDIA_AUDIO':         { level: 'medium',   desc: 'Foydalanuvchi audiolarini o\'qish' },
  'android.permission.GET_ACCOUNTS':             { level: 'high',     desc: 'Qurilmadagi akkauntlarni o\'qish' },
  'android.permission.READ_CALENDAR':            { level: 'medium',   desc: 'Kalendar voqealarini o\'qish' },
  'android.permission.WRITE_CALENDAR':           { level: 'medium',   desc: 'Kalendarga yozish' },
  'android.permission.BLUETOOTH_CONNECT':        { level: 'medium',   desc: 'Bluetooth qurilmalarga ulanish' },
  'android.permission.BLUETOOTH_SCAN':           { level: 'medium',   desc: 'Bluetooth qurilmalarni qidirish' },
  'android.permission.NFC':                      { level: 'medium',   desc: 'NFC ulanishlari' },
  'android.permission.BODY_SENSORS':             { level: 'high',     desc: 'Tana sensorlari (puls, harorat)' },
  'android.permission.ACTIVITY_RECOGNITION':     { level: 'medium',   desc: 'Foydalanuvchi harakatini aniqlash' },
  'android.permission.SYSTEM_ALERT_WINDOW':      { level: 'high',     desc: 'Boshqa ilovalar ustida ko\'rsatish (overlay)' },
  'android.permission.REQUEST_INSTALL_PACKAGES': { level: 'critical', desc: 'Boshqa APK\'larni o\'rnatish' },
  'android.permission.PACKAGE_USAGE_STATS':      { level: 'high',     desc: 'Boshqa ilovalardan foydalanish statistikasi' },
  'android.permission.QUERY_ALL_PACKAGES':       { level: 'high',     desc: 'O\'rnatilgan barcha ilovalar ro\'yxatini olish' },
  'android.permission.BIND_ACCESSIBILITY_SERVICE':{ level: 'critical', desc: 'Accessibility xizmati (juda kuchli imkoniyat)' },
  'android.permission.BIND_DEVICE_ADMIN':        { level: 'critical', desc: 'Qurilma administratori' },
  'android.permission.RECEIVE_BOOT_COMPLETED':   { level: 'low',      desc: 'Qurilma yoqilganda ishga tushish' },
  'android.permission.WAKE_LOCK':                { level: 'low',      desc: 'Ekranni yoqiq tutish' },
  'android.permission.INTERNET':                 { level: 'low',      desc: 'Internetga kirish' },
  'android.permission.ACCESS_NETWORK_STATE':     { level: 'low',      desc: 'Tarmoq holatini o\'qish' },
  'android.permission.FOREGROUND_SERVICE':       { level: 'low',      desc: 'Foreground xizmati' },
  'android.permission.POST_NOTIFICATIONS':       { level: 'low',      desc: 'Bildirishnomalar yuborish' },
};

function classifyPermission(perm) {
  const info = PERMISSION_RISK[perm];
  if (info) return info;

  if (/CONTACTS|SMS|CALL_LOG|LOCATION|CAMERA|RECORD_AUDIO|PHONE/.test(perm)) {
    return { level: 'high', desc: 'Maxfiy ma\'lumotga kirish' };
  }
  if (/STORAGE|MEDIA|CALENDAR|ACCOUNTS|BLUETOOTH|NFC/.test(perm)) {
    return { level: 'medium', desc: 'Foydalanuvchi ma\'lumotlariga kirish' };
  }
  return { level: 'low', desc: 'Standart ruxsat' };
}

function analyzePermissions(perms = []) {
  const stats = { critical: 0, high: 0, medium: 0, low: 0 };
  const enriched = perms.map(p => {
    const info = classifyPermission(p);
    stats[info.level]++;
    return { name: p, level: info.level, desc: info.desc };
  });

  // Risk score 0-100
  const score = Math.min(100, stats.critical * 18 + stats.high * 9 + stats.medium * 3 + stats.low * 0.5);
  return { enriched, stats, score: Math.round(score) };
}

module.exports = { parseManifest, analyzePermissions, classifyPermission };

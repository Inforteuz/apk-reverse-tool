// src/core/dex-parser.js
// DEX binary format string extractor
// Supports DEX 035, 036, 037, 038, 039

'use strict';

const DEX_MAGIC_PREFIX = 'dex\n';

/**
 * Read ULEB128 (unsigned little-endian base-128) integer
 * Returns { value, bytesRead }
 */
function readULEB128(buffer, offset) {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  const view = new Uint8Array(buffer);

  while (offset + bytesRead < view.length) {
    const byte = view[offset + bytesRead];
    bytesRead++;
    result |= (byte & 0x7F) << shift;
    shift += 7;
    if ((byte & 0x80) === 0) break;
    if (shift >= 35) break; // safety
  }

  return { value: result >>> 0, bytesRead };
}

/**
 * Read MUTF-8 string from DEX data section
 * Returns the decoded string or null
 */
function readMUTF8String(buffer, offset) {
  const view = new Uint8Array(buffer);
  const bytes = [];
  let pos = offset;

  while (pos < view.length) {
    const b = view[pos++];
    if (b === 0x00) break;
    bytes.push(b);
    if (bytes.length > 65536) break; // safety cap
  }

  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
  } catch (e) {
    return null;
  }
}

/**
 * Parse a single DEX file buffer and return all strings
 * @param {ArrayBuffer} buffer
 * @returns {string[]}
 */
function parseDexStrings(buffer) {
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // Validate magic
  const magic = String.fromCharCode(uint8[0], uint8[1], uint8[2], uint8[3]);
  if (magic !== DEX_MAGIC_PREFIX) {
    return [];
  }

  // DEX header offsets (little-endian uint32)
  // 0x38 = string_ids_size
  // 0x3C = string_ids_off
  if (buffer.byteLength < 0x70) return [];

  const stringIdsSize = view.getUint32(0x38, true);
  const stringIdsOff  = view.getUint32(0x3C, true);

  if (stringIdsSize === 0 || stringIdsOff === 0) return [];
  if (stringIdsOff + stringIdsSize * 4 > buffer.byteLength) return [];

  const strings = [];

  for (let i = 0; i < stringIdsSize; i++) {
    const strDataOff = view.getUint32(stringIdsOff + i * 4, true);
    if (strDataOff === 0 || strDataOff >= buffer.byteLength) continue;

    // Read ULEB128 encoded UTF-16 length (number of chars, not bytes)
    const { bytesRead } = readULEB128(buffer, strDataOff);
    const strStart = strDataOff + bytesRead;

    if (strStart >= buffer.byteLength) continue;

    const str = readMUTF8String(buffer, strStart);
    if (str !== null && str.length >= 4) {
      strings.push(str);
    }
  }

  return strings;
}

/**
 * Parse multiple DEX buffers and return unique strings
 * @param {Array<{name: string, buffer: ArrayBuffer}>} dexFiles
 * @returns {string[]}
 */
function parseAllDexStrings(dexFiles) {
  const seen = new Set();
  const allStrings = [];

  for (const { name, buffer } of dexFiles) {
    try {
      const strs = parseDexStrings(buffer);
      for (const s of strs) {
        if (!seen.has(s)) {
          seen.add(s);
          allStrings.push(s);
        }
      }
    } catch (e) {
      console.warn(`[DEX Parser] Error parsing ${name}:`, e.message);
    }
  }

  return allStrings;
}

module.exports = { parseDexStrings, parseAllDexStrings };

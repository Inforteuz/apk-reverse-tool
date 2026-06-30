// src/core/endpoint-extractor.js
// Extracts API endpoints, payloads, secrets, deep links, IPs, GraphQL, WebSockets and other intel.

'use strict';

// ─── Regex patterns ──────────────────────────────────────────────────────────

const FULL_URL_REGEX   = /https?:\/\/[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/g;
const WS_URL_REGEX     = /wss?:\/\/[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/g;
const DOMAIN_URL_REGEX = /\b([a-zA-Z0-9.-]+\.[a-zA-Z]{2,6})\/([a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\b/g;
const RELATIVE_API_SLASH_REGEX = /^(\/api|\/v\d+|\/rest|\/graphql|\/gql|\/rpc|\/service|\/ws|\/grpc)(\/[^\s"'<>{}[\]|\\^`\x00-\x1f]*)?$/;
const PATH_LIKE_REGEX    = /^\/[a-zA-Z0-9_-]{2,}(\/[a-zA-Z0-9_{}:.-]{1,}){1,6}\/?$/;
const RELATIVE_PATH_NO_SLASH_REGEX = /^(api|v\d+|rest|users|auth|login|signup|v\d+\.\d+|service|services)\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)+$/i;
const API_KEYWORD_ROUTE_REGEX = /^(\/?[a-zA-Z0-9_-]+\/)+api(\/[a-zA-Z0-9_{}:.-]+)+$/i;

// Noise / documentation domains to filter out from extracted endpoints
const NOISE_DOMAINS = [
  'docs.flutter.dev', 'flutter.dev', 'pub.dev',
  'developer.android.com', 'android.googlesource.com', 'source.android.com',
  'schemas.android.com', 'schemas.xmlsoap.org', 'schemas.microsoft.com',
  'www.w3.org', 'w3.org', 'xmlns.jcp.org',
  'github.com/flutter', 'github.com/dart-lang',
  'fonts.gstatic.com', 'fonts.googleapis.com',
  'tools.ietf.org', 'tools.google.com',
  'json-schema.org', 'jsonapi.org',
  'kotlinlang.org', 'reactivex.io',
  'docs.oracle.com', 'oracle.com/java',
  'spdx.org', 'opensource.org', 'creativecommons.org',
  'apache.org', 'gnu.org',
  'stackoverflow.com', 'example.com', 'example.org',
];

function isNoiseUrl(url) {
  const lower = url.toLowerCase();
  return NOISE_DOMAINS.some(d => lower.includes(d));
}

// IPv4 with optional port
const IP_PORT_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?::\d{2,5})?\b/g;
// IPv6 (compact)
const IP6_REGEX = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g;

// Deep link / custom scheme like myapp://something or appname://host/path
const DEEPLINK_REGEX = /\b([a-zA-Z][a-zA-Z0-9+.-]{1,30}):\/\/[a-zA-Z0-9_.~%+/?=&-]+/g;

// GraphQL query/mutation/subscription detection
const GRAPHQL_OPERATION_REGEX = /\b(query|mutation|subscription)\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;

// S3 buckets
const S3_BUCKET_REGEX = /\b([a-z0-9.-]{3,63})\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com\b/g;

// ─── HTTP Method detection ───────────────────────────────────────────────────

const METHOD_CONTEXT_KEYWORDS = {
  'GET':    ['get', 'fetch', 'load', 'retrieve', 'query', 'list', 'find', 'search', 'read'],
  'POST':   ['post', 'create', 'add', 'submit', 'send', 'upload', 'register', 'login', 'auth'],
  'PUT':    ['put', 'update', 'edit', 'modify', 'replace', 'set'],
  'DELETE': ['delete', 'remove', 'destroy', 'purge'],
  'PATCH':  ['patch', 'partial', 'update']
};

// ─── Payload / Parameter patterns ───────────────────────────────────────────

const JSON_KEY_REGEX     = /"([a-zA-Z_][a-zA-Z0-9_]{1,50})"\s*:/g;
const QUERY_PARAM_REGEX  = /[?&]([a-zA-Z_][a-zA-Z0-9_]{1,50})=/g;
const FORM_FIELD_REGEX   = /\b(username|password|email|phone|token|code|key|id|name|type|status|page|limit|offset|sort|order|filter|search|q)\b/gi;

// ─── Secret / Token patterns (kengaytirilgan) ────────────────────────────────
// severity: critical | high | medium | low

const SECRET_PATTERNS = [
  // JWT
  { name: 'JWT Token',            severity: 'high',     regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/ },

  // Google / Firebase
  { name: 'Firebase API Key',     severity: 'high',     regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Google OAuth Client',  severity: 'high',     regex: /\d{12}-[a-z0-9]{32}\.apps\.googleusercontent\.com/ },
  { name: 'Google API Key',       severity: 'high',     regex: /ya29\.[0-9A-Za-z_-]{20,}/ },

  // AWS
  { name: 'AWS Access Key',       severity: 'critical', regex: /(?:^|[^A-Z0-9])(AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)/ },
  { name: 'AWS Temp Key',         severity: 'critical', regex: /(?:^|[^A-Z0-9])(ASIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)/ },
  { name: 'AWS Secret',           severity: 'critical', regex: /(?:aws_secret|secret_access_key)["'\s:=]+([A-Za-z0-9/+=]{40})/i },

  // Stripe / Square
  { name: 'Stripe Live Key',      severity: 'critical', regex: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'Stripe Test Key',      severity: 'medium',   regex: /sk_test_[0-9a-zA-Z]{24,}/ },
  { name: 'Stripe Public Key',    severity: 'low',      regex: /pk_(test|live)_[0-9a-zA-Z]{24,}/ },
  { name: 'Square Token',         severity: 'high',     regex: /sq0(?:atp|csp)-[0-9A-Za-z_-]{22,}/ },

  // OpenAI / Anthropic / Mistral
  { name: 'OpenAI Key',           severity: 'high',     regex: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { name: 'Anthropic API Key',    severity: 'high',     regex: /sk-ant-[A-Za-z0-9_-]{30,}/ },
  { name: 'Mistral API Key',      severity: 'high',     regex: /[A-Za-z0-9]{32}-[A-Za-z0-9]{8}/ },

  // GitHub / GitLab
  { name: 'GitHub Token',         severity: 'high',     regex: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: 'GitHub OAuth',         severity: 'high',     regex: /gho_[A-Za-z0-9]{36}/ },
  { name: 'GitLab Token',         severity: 'high',     regex: /glpat-[A-Za-z0-9_-]{20}/ },

  // Slack / Discord / Telegram
  { name: 'Slack Token',          severity: 'high',     regex: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: 'Slack Webhook',        severity: 'high',     regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/ },
  { name: 'Discord Bot Token',    severity: 'high',     regex: /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/ },
  { name: 'Discord Webhook',      severity: 'medium',   regex: /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/ },
  { name: 'Telegram Bot Token',   severity: 'high',     regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },

  // SendGrid / Mailgun / Twilio
  { name: 'SendGrid Key',         severity: 'high',     regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/ },
  { name: 'Mailgun API Key',      severity: 'high',     regex: /key-[a-z0-9]{32}/ },
  { name: 'Twilio Account SID',   severity: 'medium',   regex: /AC[a-f0-9]{32}/ },

  // Maps & other paid APIs
  { name: 'Mapbox Token',         severity: 'medium',   regex: /pk\.[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{20,}/ },

  // Auth headers / bearer
  { name: 'Bearer Token',         severity: 'medium',   regex: /Bearer\s+([A-Za-z0-9\-._~+/]{20,}=*)/ },
  { name: 'Basic Auth',           severity: 'high',     regex: /Basic\s+([A-Za-z0-9+/]{16,}=*)/ },

  // Generic variable assignments
  { name: 'Hardcoded Password',   severity: 'critical', regex: /password["'\s]*[:=][\s]*["']([^"']{6,})["']/i },
  { name: 'API Key Variable',     severity: 'high',     regex: /api[_-]?key["'\s]*[:=][\s]*["']([^"']{12,})["']/i },
  { name: 'Secret Key Variable',  severity: 'high',     regex: /secret[_-]?key["'\s]*[:=][\s]*["']([^"']{12,})["']/i },
  { name: 'Access Token',         severity: 'high',     regex: /access[_-]?token["'\s]*[:=][\s]*["']([^"']{12,})["']/i },
  { name: 'Client Secret',        severity: 'high',     regex: /client[_-]?secret["'\s]*[:=][\s]*["']([^"']{12,})["']/i },
  { name: 'Encryption Key',       severity: 'critical', regex: /(?:encryption|aes|cipher)[_-]?key["'\s]*[:=][\s]*["']([^"']{16,})["']/i },

  // Private keys
  { name: 'RSA Private Key',      severity: 'critical', regex: /-----BEGIN RSA PRIVATE KEY-----/ },
  { name: 'PGP Private Key',      severity: 'critical', regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----/ },
  { name: 'SSH Private Key',      severity: 'critical', regex: /-----BEGIN (?:OPENSSH|DSA|EC) PRIVATE KEY-----/ },

  // Other
  { name: 'Heroku API Key',       severity: 'high',     regex: /[hH]eroku[\s_-]*[aApP][iI][\s_-]*[kK]ey[\s_-]*[:=][\s]*["']?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/ },
  { name: 'PayPal/Braintree',     severity: 'high',     regex: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/ },
  { name: 'Crypto Wallet',        severity: 'medium',   regex: /\b0x[a-fA-F0-9]{40}\b/ },
];

// ─── Header patterns ─────────────────────────────────────────────────────────

const HEADER_PATTERNS = [
  /^Authorization$/i,
  /^Content-Type$/i,
  /^Accept$/i,
  /^Accept-Language$/i,
  /^X-[A-Za-z0-9-]+$/,
  /^User-Agent$/i,
  /^Referer$/i,
  /^Origin$/i,
  /^Cookie$/i,
  /^Set-Cookie$/i,
  /^api[_-]?key$/i,
  /^token$/i,
  /^bearer$/i,
  /^X-Auth-Token$/i,
  /^X-Api-Key$/i,
  /^X-Request-Id$/i,
  /^X-Forwarded-For$/i,
  /^X-CSRF-Token$/i,
  /^X-Device-Id$/i,
  /^X-Client-Version$/i,
];

// ─── Firebase / Analytics ────────────────────────────────────────────────────

const FIREBASE_PATTERNS = [
  /https?:\/\/[a-z0-9-]+\.firebaseio\.com/,
  /https?:\/\/[a-z0-9-]+\.firebase\.google\.com/,
  /https?:\/\/[a-z0-9-]+\.firebaseapp\.com/,
  /https?:\/\/[a-z0-9-]+\.cloudfunctions\.net/,
  /[a-z0-9-]+\.firebasestorage\.googleapis\.com/,
  /[a-z0-9-]+\.appspot\.com/,
];

// ─── Common false-positives to skip in IP detection ──────────────────────────
const PRIVATE_IP_PREFIXES = ['10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '127.', '0.0.0.0'];

// ─── Main extractor ──────────────────────────────────────────────────────────

function extractFromStrings(strings, options = {}) {
  const opts = {
    endpoints: true,
    payloads:  true,
    headers:   true,
    secrets:   true,
    firebase:  true,
    deeplinks: true,
    ...options
  };

  const results = {
    endpoints: [],
    payloads:  [],
    headers:   [],
    secrets:   [],
    firebase:  [],
    baseUrls:  [],
    deeplinks: [],
    websockets: [],
    ips:        [],
    graphql:    [],
    s3Buckets:  [],
    stats: {
      totalStrings: strings.length,
      urlsFound:    0,
      pathsFound:   0,
      secretsFound: 0,
      headersFound: 0,
      criticalSecrets: 0,
      highSecrets: 0,
    }
  };

  const seenUrls    = new Set();
  const seenSecrets = new Set();
  const seenHeaders = new Set();
  const seenDeep    = new Set();
  const seenIp      = new Set();
  const seenWs      = new Set();
  const seenGql     = new Set();
  const seenS3      = new Set();
  const payloadKeys = new Set();
  const baseUrls    = new Set();
  // Count how often each base URL appears in extracted endpoints
  const baseUrlCounts = {};

  // Common scheme names to consider as deeplinks (skip http, https, file, content, etc.)
  const skipSchemes = new Set(['http', 'https', 'file', 'content', 'data', 'mailto', 'tel', 'sms', 'javascript', 'about', 'res', 'android-app', 'android.resource', 'ws', 'wss']);

  for (const str of strings) {
    if (!str || str.length < 4) continue;

    // Skip class file paths
    if (str.startsWith('L') && str.endsWith(';') && str.includes('/')) continue;

    // ── Full URL extraction ──────────────────────────────────────────────
    if (opts.endpoints) {
      const urlMatches = str.matchAll(FULL_URL_REGEX);
      for (const match of urlMatches) {
        const url = match[0].replace(/['"`,;)\s]+$/, '');
        if (url.length < 10) continue;
        if (seenUrls.has(url)) continue;
        if (isNoiseUrl(url)) continue;
        seenUrls.add(url);

        try {
          const parsed = new URL(url);
          const baseUrl = `${parsed.protocol}//${parsed.host}`;
          baseUrls.add(baseUrl);
          baseUrlCounts[baseUrl] = (baseUrlCounts[baseUrl] || 0) + 1;

          const method = inferMethod(parsed.pathname, parsed.searchParams);
          const queryParams = [];
          parsed.searchParams.forEach((val, key) => {
            queryParams.push({ key, value: val || '<value>' });
          });

          results.endpoints.push({
            type:        'full_url',
            method,
            url,
            baseUrl,
            path:        parsed.pathname,
            queryParams,
            confidence:  'high',
            rawString:   str.length > 200 ? str.substring(0, 200) + '...' : str,
          });
          results.stats.urlsFound++;
        } catch (e) {}
      }

      // WebSocket URLs
      const wsMatches = str.matchAll(WS_URL_REGEX);
      for (const m of wsMatches) {
        const url = m[0].replace(/['"`,;)\s]+$/, '');
        if (!seenWs.has(url)) {
          seenWs.add(url);
          results.websockets.push(url);
        }
      }

      // ── Domain URLs without http(s) prefix ──────────────────────────────
      const domainMatches = str.matchAll(DOMAIN_URL_REGEX);
      for (const match of domainMatches) {
        const rawUrl = match[0].replace(/['"`,;)\s]+$/, '');
        if (rawUrl.startsWith('com.google') || rawUrl.startsWith('android.') || rawUrl.startsWith('java.')) continue;
        if (isNoiseUrl(rawUrl)) continue;

        const absoluteUrl = 'https://' + rawUrl;
        if (seenUrls.has(absoluteUrl) || seenUrls.has(rawUrl)) continue;
        seenUrls.add(absoluteUrl);

        try {
          const parsed = new URL(absoluteUrl);
          const baseUrl = `${parsed.protocol}//${parsed.host}`;
          baseUrls.add(baseUrl);
          baseUrlCounts[baseUrl] = (baseUrlCounts[baseUrl] || 0) + 1;

          const method = inferMethod(parsed.pathname, parsed.searchParams);
          const queryParams = [];
          parsed.searchParams.forEach((val, key) => {
            queryParams.push({ key, value: val || '<value>' });
          });

          results.endpoints.push({
            type:        'full_url',
            method,
            url:         absoluteUrl,
            baseUrl,
            path:        parsed.pathname,
            queryParams,
            confidence:  'medium',
            rawString:   str,
          });
          results.stats.urlsFound++;
        } catch (e) {}
      }

      // S3 buckets
      const s3Matches = str.matchAll(S3_BUCKET_REGEX);
      for (const m of s3Matches) {
        const v = m[0];
        if (!seenS3.has(v)) {
          seenS3.add(v);
          results.s3Buckets.push(v);
        }
      }

      // IPs
      const ipMatches = str.match(IP_PORT_REGEX);
      if (ipMatches) {
        for (const ip of ipMatches) {
          const naked = ip.split(':')[0];
          // skip versions like "1.0.0" being treated as IPs only if all octets present
          if (PRIVATE_IP_PREFIXES.some(p => naked.startsWith(p))) {
            if (!seenIp.has(ip)) {
              seenIp.add(ip);
              results.ips.push({ ip, type: 'private' });
            }
          } else if (!seenIp.has(ip) && naked !== '255.255.255.255' && !/^(\d+\.){3}0$/.test(naked)) {
            seenIp.add(ip);
            results.ips.push({ ip, type: 'public' });
          }
        }
      }

      // Firebase URLs
      if (opts.firebase) {
        for (const pat of FIREBASE_PATTERNS) {
          if (pat.test(str)) {
            if (!results.firebase.includes(str.trim())) {
              results.firebase.push(str.trim());
            }
            break;
          }
        }
      }
    }

    // ── Deep links ───────────────────────────────────────────────────────
    if (opts.deeplinks) {
      const dlMatches = str.matchAll(DEEPLINK_REGEX);
      for (const m of dlMatches) {
        const full = m[0];
        const scheme = m[1].toLowerCase();
        if (skipSchemes.has(scheme)) continue;
        if (scheme.length > 30) continue;
        if (seenDeep.has(full)) continue;
        seenDeep.add(full);
        results.deeplinks.push({ scheme, url: full });
      }
    }

    // ── GraphQL operations ───────────────────────────────────────────────
    const gqlMatches = str.matchAll(GRAPHQL_OPERATION_REGEX);
    for (const m of gqlMatches) {
      const op = `${m[1]} ${m[2]}`;
      if (!seenGql.has(op)) {
        seenGql.add(op);
        results.graphql.push({ kind: m[1].toLowerCase(), name: m[2] });
      }
    }

    // ── Relative API paths (slashed or unslashed) ───────────────────────────
    if (opts.endpoints) {
      const isRelativeSlash = RELATIVE_API_SLASH_REGEX.test(str);
      const isPathLike      = PATH_LIKE_REGEX.test(str);
      const isNoSlashRoute  = RELATIVE_PATH_NO_SLASH_REGEX.test(str);
      const isApiKeyword    = API_KEYWORD_ROUTE_REGEX.test(str);

      if (isRelativeSlash || isPathLike || isNoSlashRoute || isApiKeyword) {
        let clean = str.replace(/['"`,\s]+$/, '');
        if (!clean.startsWith('/') && !clean.startsWith('http')) clean = '/' + clean;

        if (!seenUrls.has(clean) && clean.length < 200) {
          seenUrls.add(clean);
          const method = inferMethod(clean, null);
          let confidence = 'medium';
          if (isRelativeSlash || isNoSlashRoute || isApiKeyword) confidence = 'high';
          else if (clean.includes('/api/')) confidence = 'high';

          results.endpoints.push({
            type:       'relative_path',
            method,
            url:        clean,
            path:       clean,
            queryParams: [],
            confidence,
            rawString:  str,
          });
          results.stats.pathsFound++;
        }
      }
    }

    // ── Headers ───────────────────────────────────────────────────────────
    if (opts.headers) {
      for (const pattern of HEADER_PATTERNS) {
        if (pattern.test(str) && str.length < 80 && !seenHeaders.has(str)) {
          seenHeaders.add(str);
          results.headers.push(str);
          results.stats.headersFound++;
          break;
        }
      }
    }

    // ── Secrets ───────────────────────────────────────────────────────────
    if (opts.secrets) {
      for (const { name, regex, severity } of SECRET_PATTERNS) {
        const m = str.match(regex);
        if (m) {
          const found = m[0];
          if (!seenSecrets.has(found) && found.length > 8 && found.length < 500) {
            seenSecrets.add(found);
            results.secrets.push({
              type:     name,
              severity: severity || 'medium',
              value:    found,
              source:   str.length > 150 ? str.substring(0, 150) + '...' : str,
            });
            results.stats.secretsFound++;
            if (severity === 'critical') results.stats.criticalSecrets++;
            else if (severity === 'high') results.stats.highSecrets++;
          }
        }
      }
    }

    // ── Payload keys ──────────────────────────────────────────────────────
    if (opts.payloads) {
      const jsonMatches = str.matchAll(JSON_KEY_REGEX);
      for (const m of jsonMatches) payloadKeys.add(m[1]);
      const queryMatches = str.matchAll(QUERY_PARAM_REGEX);
      for (const m of queryMatches) payloadKeys.add(m[1]);
      const formMatches = str.match(FORM_FIELD_REGEX);
      if (formMatches) for (const f of formMatches) payloadKeys.add(f.toLowerCase());
    }
  }

  if (opts.payloads && payloadKeys.size > 0) {
    results.payloads = [...payloadKeys].sort().map(key => ({
      key,
      type: guessPayloadType(key),
    }));
  }

  // Sort base URLs by frequency (most used first)
  const sortedBases = Object.entries(baseUrlCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url);
  results.baseUrls = sortedBases.length > 0 ? sortedBases : [...baseUrls];

  // Strongest base URL — picked automatically. Prefer ones with /api in pathnames
  results.primaryBaseUrl = pickPrimaryBaseUrl(results.endpoints, baseUrlCounts);

  if (opts.payloads && results.payloads.length > 0) {
    for (const ep of results.endpoints) {
      if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
        ep.samplePayload = buildSamplePayload(results.payloads);
      }
      // Per-endpoint inferred payload (from URL pattern)
      ep.inferredPayloadKeys = inferPayloadKeysFromUrl(ep.url || ep.path || '');
    }
  }

  // Sort secrets by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  results.secrets.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferMethod(pathname, searchParams) {
  const path = (pathname || '').toLowerCase();
  for (const [method, keywords] of Object.entries(METHOD_CONTEXT_KEYWORDS)) {
    for (const kw of keywords) {
      if (path.includes(kw)) {
        const re = new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`);
        if (re.test(path)) return method;
      }
    }
  }
  if (searchParams && [...searchParams.keys()].length > 0) return 'GET';
  if (/\{[^}]+\}$/.test(pathname) || /\/\d+\/?$/.test(pathname)) return 'GET';
  return 'POST';
}

function guessPayloadType(key) {
  const k = key.toLowerCase();
  if (['id', 'user_id', 'product_id', 'order_id'].includes(k)) return 'integer';
  if (['email'].includes(k)) return 'string (email)';
  if (['password', 'pass', 'pwd'].includes(k)) return 'string (password)';
  if (['phone', 'mobile', 'tel'].includes(k)) return 'string (phone)';
  if (['page', 'limit', 'offset', 'count', 'size'].includes(k)) return 'integer';
  if (['active', 'enabled', 'is_admin', 'verified'].includes(k)) return 'boolean';
  if (['created_at', 'updated_at', 'date', 'timestamp'].includes(k)) return 'string (datetime)';
  if (['token', 'access_token', 'refresh_token', 'api_key'].includes(k)) return 'string (token)';
  if (['amount', 'price', 'total', 'fee'].includes(k)) return 'number';
  return 'string';
}

function pickPrimaryBaseUrl(endpoints, baseUrlCounts) {
  if (!Object.keys(baseUrlCounts).length) return '';
  // Among base URLs, prefer ones where at least one endpoint path contains /api/
  const apiBases = {};
  for (const ep of endpoints) {
    if (ep.type === 'full_url' && ep.baseUrl && /\/api\//i.test(ep.path || '')) {
      apiBases[ep.baseUrl] = (apiBases[ep.baseUrl] || 0) + 1;
    }
  }
  const candidates = Object.keys(apiBases).length ? apiBases : baseUrlCounts;
  return Object.entries(candidates).sort((a, b) => b[1] - a[1])[0][0];
}

// From a URL like /api/v1/users/create, infer keys: ['users', 'create'] → name, etc.
function inferPayloadKeysFromUrl(url) {
  if (!url) return [];
  let pathOnly = url;
  try {
    if (/^https?:\/\//i.test(url)) pathOnly = new URL(url).pathname;
  } catch (e) {}

  const segments = pathOnly.split('/').filter(s => s && !/^v?\d+$/i.test(s) && s !== 'api' && s !== 'rest');
  const keys = new Set();

  for (const seg of segments) {
    const clean = seg.replace(/^[:{].*[}]?$/, '').toLowerCase();
    if (!clean || clean.length < 2) continue;

    // Map common resources to expected payload keys
    if (clean.includes('login') || clean.includes('signin')) {
      ['username', 'password', 'email'].forEach(k => keys.add(k));
    } else if (clean.includes('register') || clean.includes('signup')) {
      ['username', 'password', 'email', 'phone'].forEach(k => keys.add(k));
    } else if (clean.includes('otp')) {
      ['phone', 'code', 'otp'].forEach(k => keys.add(k));
    } else if (clean.includes('user')) {
      ['user_id', 'name'].forEach(k => keys.add(k));
    } else if (clean.includes('product')) {
      ['product_id', 'name', 'price'].forEach(k => keys.add(k));
    } else if (clean.includes('order')) {
      ['order_id', 'amount', 'status'].forEach(k => keys.add(k));
    } else if (clean.includes('quiz')) {
      ['quiz_id', 'answers'].forEach(k => keys.add(k));
    } else if (clean.includes('course')) {
      ['course_id'].forEach(k => keys.add(k));
    } else if (clean.includes('story')) {
      ['story_id'].forEach(k => keys.add(k));
    } else if (clean.includes('story')) {
      ['client_id'].forEach(k => keys.add(k));
    } else if (clean.includes('subscribe') || clean.includes('notification')) {
      ['token', 'topic'].forEach(k => keys.add(k));
    } else if (clean.includes('certificate')) {
      ['user_id', 'certificate_id'].forEach(k => keys.add(k));
    } else if (clean.includes('leaderboard')) {
      ['period', 'limit'].forEach(k => keys.add(k));
    } else if (clean.includes('upload')) {
      ['file', 'type'].forEach(k => keys.add(k));
    } else if (clean.includes('search')) {
      ['q', 'page', 'limit'].forEach(k => keys.add(k));
    } else if (clean.includes('store')) {
      ['store_id'].forEach(k => keys.add(k));
    } else {
      // Generic: use last meaningful segment as `${seg}_id`
      keys.add(`${clean.replace(/[^a-z0-9_]/g, '')}_id`);
    }
  }
  return [...keys].slice(0, 8);
}

function buildSamplePayload(payloadItems) {
  const obj = {};
  for (const { key, type } of payloadItems.slice(0, 10)) {
    if (type.startsWith('integer')) obj[key] = 1;
    else if (type.startsWith('boolean')) obj[key] = true;
    else if (type.startsWith('number')) obj[key] = 0.00;
    else if (type.includes('email')) obj[key] = 'user@example.com';
    else if (type.includes('password')) obj[key] = '••••••••';
    else if (type.includes('token')) obj[key] = '<token>';
    else obj[key] = '<string>';
  }
  return JSON.stringify(obj, null, 2);
}

module.exports = { extractFromStrings };

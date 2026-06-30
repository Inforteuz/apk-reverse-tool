# APK Reverse Tool

> Professional APK/XAPK reverse engineering tool for macOS — endpoints, secrets, deeplinks, GraphQL, WebSockets, Firebase and more.

Built with **Electron + React 19 + TypeScript + Tailwind CSS 4**.

---

## Features

- 📦 **APK + XAPK** support (multi-split APKs)
- 🔍 **API endpoints** discovery — full URLs + relative paths with smart base-URL resolution
- 🔐 **40+ secret patterns** — AWS, Stripe, OpenAI, Anthropic, Firebase, GitHub, Slack, Discord, Telegram, Mapbox, RSA/PGP/SSH keys, hardcoded passwords/tokens
- 🛡️ **Risk scoring** (0–100) — combined manifest + secrets analysis
- 🧠 **Tech stack detection** — Flutter, React Native, Unity, Xamarin, Cordova, NativeScript, Native, Kotlin
- 🗓️ **Build date detection** — from META-INF/MANIFEST.MF or string timestamps
- 🏛️ **Architecture detection** — arm64, armeabi, x86_64
- 🔗 **Deep links** (custom schemes)
- 🌐 **Network sources** — IP addresses (public/private), WebSockets
- ⚙️ **GraphQL** operations — queries, mutations, subscriptions
- 🔥 **Firebase / Cloud** URLs
- 📋 **HTTP headers** detection
- 📡 **Built-in API Tester** (mini-Postman) — collections, history, auth (Bearer/Basic)
- 🎯 **Per-endpoint payload inference** based on URL pattern
- 🌍 **3 languages** — Uzbek, Russian, English
- 🎨 **Native macOS UI** — minimalist, vibrancy, native loaders
- 📤 **Export** — JSON, CSV, Markdown

## Screenshots

(Soon)

## Build from source

```bash
git clone https://github.com/Inforteuz/apk-reverse-tool.git
cd apk-reverse-tool
npm install
npm run dev        # development
npm run dist       # build DMG
```

## Tech stack

- **Electron 31** — native macOS shell
- **React 19** with TypeScript
- **Vite 8** — bundler
- **Tailwind CSS 4** — styling
- **Zustand** — state management
- **JSZip** — APK unpacking
- **lucide-react** — icons

## Project structure

```
src/
├── main.js                  # Electron main process
├── preload.js               # IPC bridge
├── core/                    # Analysis engine
│   ├── apk-parser.js        # APK/XAPK unpacking
│   ├── apk-metadata.js      # Tech stack + build-date detection
│   ├── dex-parser.js        # DEX string extraction
│   ├── manifest-parser.js   # AXML manifest parser + permission risk
│   └── endpoint-extractor.js# Endpoints, secrets, deeplinks, ...
└── renderer/                # React UI
    ├── App.tsx
    ├── store.ts             # Zustand store
    ├── i18n.ts              # uz / ru / en dictionaries
    └── components/
        ├── Welcome.tsx
        ├── Analyzing.tsx
        ├── Results.tsx
        ├── Postman.tsx      # Mini-Postman tester
        ├── AiAnalysis.tsx
        └── AboutDev.tsx
```

## Author

**Oyatillo** — FullStack Web Developer · [inforte.uz](https://inforte.uz) · anoyatillo16@gmail.com

## License

MIT — for **educational, security research, and personal learning** purposes only.

Unauthorized reverse engineering of others' intellectual property is prohibited.

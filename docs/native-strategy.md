# Native strategy: Android, iOS, macOS and Windows

**Principle: the web app is the product.** Native apps are thin shells that load the deployed web app and add the few capabilities a browser cannot offer. A merge to `main` deploys to Vercel and updates every platform at once, with no store review for product changes.

Status: the web app and PWA ship today. The shells below are planned; this document fixes the architecture so the web code is already ready for them.

## Shells

| Platform     | Shell                                                | Loads                          | Native additions                                                                                           |
| ------------ | ---------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Android      | [Capacitor](https://capacitorjs.com) (`apps/mobile`) | `https://<production domain>/` | Speech (Android recogniser or on-device Whisper), notifications, haptics, home-screen widget, share target |
| iOS / iPadOS | Capacitor (`apps/mobile`, same project)              | same                           | Speech (SFSpeechRecognizer), notifications, haptics, WidgetKit widget, Siri Shortcuts                      |
| macOS        | [Tauri 2](https://tauri.app) (`apps/desktop`)        | same                           | Menu-bar quick add, global shortcut to open the Voice Dock, notifications, launch at login                 |
| Windows      | Tauri 2 (`apps/desktop`, same project)               | same                           | Tray quick add, global shortcut, notifications                                                             |

Why these: Capacitor has the most mature mobile plugin ecosystem and lets one project target both mobile stores; Tauri gives small, fast desktop binaries with a system WebView and an auto-updater for the shell itself.

### Remote URL plus offline fallback

Each shell points its WebView at the production URL (Capacitor `server.url`, Tauri window URL) and bundles a tiny offline page. The web app already ships a service worker with an offline page (`public/sw.js`). Supabase hosts (`*.supabase.co`) are allowed navigation and connect targets.

Store guidelines (Apple 4.2 "minimum functionality") reward native value, which is why each shell adds widgets, notifications and system shortcuts rather than being a bare wrapper.

## The bridge contract

Web code never imports native SDKs. It feature-detects a small global that shells inject:

```ts
interface Window {
  PowerWeekNative?: {
    speech?: NativeSpeechBridge; // implemented first
    // planned: haptics, notifications, share, widgets
  };
}

interface NativeSpeechBridge {
  start(options: { lang: string }, callbacks: SpeechCallbacks): SpeechSession;
}
```

`apps/web/lib/voice/speech.ts` already prefers `window.PowerWeekNative.speech` and falls back to the Web Speech API, then to typing. A shell implements the bridge with a Capacitor plugin (`registerPlugin("PowerWeekSpeech")`) or a Tauri command, and exposes it on `window` before the app loads.

New capabilities follow the same pattern: define the TypeScript interface in `apps/web/lib`, feature-detect it, ship the web fallback first, then implement it per shell.

## Auth inside shells

Sessions are cookies set by `@supabase/ssr`, which work inside WebViews loading the remote URL. Email links open the system browser; to land back in the app, the shells register the production domain for App Links / Universal Links (`/.well-known/assetlinks.json`, `apple-app-site-association` served by the web app) and route `/auth/callback` into the WebView. OAuth providers, when added, use the in-app browser plus the same deep link.

## Offline (phase 2)

The architecture already supports it:

- Operations are pure and replayable, and `applyOperations` runs in the browser.
- Planned: cache the plan in IndexedDB, queue operations while offline, and on reconnect replay them against the latest version with the existing `save_plan(expected_version)` conflict check.

## Release process

| What changed                  | How it ships                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Product, UI, copy, assistant  | Merge to `main` → Vercel deploy → every platform updated                                                            |
| Native bridge or shell config | Shell release through the stores (GitHub Actions with fastlane for mobile; Tauri's bundler and updater for desktop) |
| Database                      | Migration in `supabase/migrations`, applied before the web deploy that needs it                                     |

Shell versions declare the bridge capabilities they implement (`PowerWeekNative.version`), so the web app degrades gracefully on old shells.

## Repository plan

```
apps/web        today
apps/mobile     Capacitor project (android/, ios/), capacitor.config.ts with server.url
apps/desktop    Tauri project (src-tauri/), window URL + tray + shortcuts
packages/core   shared by all of them if a shell ever needs domain logic natively
```

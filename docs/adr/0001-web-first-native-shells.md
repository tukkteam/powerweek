# 0001 · Web-first; native apps are shells around the deployed web app

Date: 2026-11-13 · Status: Accepted

## Context

PowerWeek must run on the web, Android, iOS, macOS and Windows. The team is small and wants deploys and updates to be trivial. The previous prototype bundled a static build into an Android APK and broke whenever the web build changed shape (SSR output is not a static bundle).

## Decision

The web app is the only product implementation. Native apps (Capacitor for mobile, Tauri for desktop) load the production URL in a WebView, ship an offline page, and add native capabilities through a feature-detected `window.PowerWeekNative` bridge. Details: [native-strategy.md](../native-strategy.md).

## Consequences

- A merge to `main` updates every platform; store releases are only needed when a shell or bridge changes.
- The web app must never assume a browser-only API without a fallback, and must stay fast on mobile WebViews.
- Store reviewers expect native value, so shells add widgets, notifications and shortcuts rather than being bare wrappers.
